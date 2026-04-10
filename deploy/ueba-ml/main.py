from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import numpy as np
from datetime import datetime

app = FastAPI(title="UEBA ML Microservice", version="1.0.0")

FEATURE_NAMES = [
    "login_hour",
    "failed_attempts",
    "session_duration",
    "bytes_transferred",
    "unique_destinations",
    "privilege_level",
]

# Module-level state
model: Optional[IsolationForest] = None
scaler: Optional[StandardScaler] = None
training_timestamp: Optional[str] = None
sample_count: int = 0


class FeatureDict(BaseModel):
    login_hour: float = 0
    failed_attempts: float = 0
    session_duration: float = 0
    bytes_transferred: float = 0
    unique_destinations: float = 0
    privilege_level: float = 0

    def to_array(self) -> List[float]:
        return [
            self.login_hour,
            self.failed_attempts,
            self.session_duration,
            self.bytes_transferred,
            self.unique_destinations,
            self.privilege_level,
        ]


class TrainRequest(BaseModel):
    data: List[Dict[str, Any]]


class PredictRequest(BaseModel):
    features: Dict[str, Any]


class BatchPredictRequest(BaseModel):
    data: List[Dict[str, Any]]


def dict_to_features(d: Dict[str, Any]) -> List[float]:
    return [float(d.get(name, 0)) for name in FEATURE_NAMES]


def _train_model(X: np.ndarray) -> None:
    global model, scaler, training_timestamp, sample_count

    sc = StandardScaler()
    X_scaled = sc.fit_transform(X)

    clf = IsolationForest(
        contamination=0.1,
        n_estimators=100,
        random_state=42,
    )
    clf.fit(X_scaled)

    model = clf
    scaler = sc
    sample_count = len(X)
    training_timestamp = datetime.utcnow().isoformat() + "Z"


def _seed_model() -> None:
    """Pre-train the model with synthetic normal data so it is ready immediately."""
    rng = np.random.default_rng(42)
    X = np.column_stack([
        rng.uniform(7, 19, 100),       # login_hour  (business hours)
        rng.integers(0, 3, 100).astype(float),  # failed_attempts
        rng.uniform(60, 3600, 100),    # session_duration (seconds)
        rng.uniform(1e3, 1e7, 100),    # bytes_transferred
        rng.integers(1, 10, 100).astype(float),  # unique_destinations
        rng.integers(1, 4, 100).astype(float),   # privilege_level
    ])
    _train_model(X)


# ---------- Startup ----------

@app.on_event("startup")
def startup_event() -> None:
    _seed_model()


# ---------- Endpoints ----------

@app.post("/train")
def train(request: TrainRequest):
    if not request.data:
        raise HTTPException(status_code=400, detail="Training data must not be empty.")

    try:
        X = np.array([dict_to_features(d) for d in request.data], dtype=float)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Feature extraction failed: {exc}")

    _train_model(X)

    return {
        "success": True,
        "message": "Model trained successfully.",
        "sample_count": sample_count,
        "trained_at": training_timestamp,
    }


@app.post("/predict")
def predict(request: PredictRequest):
    if model is None or scaler is None:
        raise HTTPException(status_code=503, detail="Model not trained.")

    try:
        x = np.array([dict_to_features(request.features)], dtype=float)
        x_scaled = scaler.transform(x)
        raw_score = float(model.score_samples(x_scaled)[0])
        label = int(model.predict(x_scaled)[0])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Prediction failed: {exc}")

    # Normalise score to [-1, 1]; IsolationForest score_samples returns negative
    # floats (more negative = more anomalous). We invert so that -1 = anomaly.
    return {
        "success": True,
        "anomaly_score": raw_score,
        "is_anomaly": label == -1,
        "label": label,
    }


@app.post("/batch-predict")
def batch_predict(request: BatchPredictRequest):
    if model is None or scaler is None:
        raise HTTPException(status_code=503, detail="Model not trained.")

    if not request.data:
        raise HTTPException(status_code=400, detail="Input data must not be empty.")

    try:
        X = np.array([dict_to_features(d) for d in request.data], dtype=float)
        X_scaled = scaler.transform(X)
        scores = model.score_samples(X_scaled).tolist()
        labels = model.predict(X_scaled).tolist()
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Batch prediction failed: {exc}")

    results = [
        {
            "index": i,
            "anomaly_score": scores[i],
            "is_anomaly": labels[i] == -1,
            "label": labels[i],
        }
        for i in range(len(request.data))
    ]

    return {
        "success": True,
        "count": len(results),
        "predictions": results,
    }


@app.get("/health")
def health():
    return {
        "success": True,
        "status": "trained" if model is not None else "untrained",
        "sample_count": sample_count,
        "last_trained": training_timestamp,
    }


@app.get("/stats")
def stats():
    if model is None:
        return {
            "success": True,
            "model_ready": False,
            "message": "Model has not been trained yet.",
        }

    return {
        "success": True,
        "model_ready": True,
        "parameters": {
            "contamination": model.contamination,
            "n_estimators": model.n_estimators,
            "random_state": model.random_state,
        },
        "training": {
            "sample_count": sample_count,
            "last_trained": training_timestamp,
            "feature_names": FEATURE_NAMES,
        },
        "scaler": {
            "mean": scaler.mean_.tolist(),
            "scale": scaler.scale_.tolist(),
        },
    }
