"""
FastAPI application with scheduled jobs and management endpoints.
"""

import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Body
from apscheduler.schedulers.background import BackgroundScheduler

from linkedin_client import LinkedInClient
from prospector import Prospector
from messenger import Messenger
from publisher import Publisher
import config

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Global instances
li_client = LinkedInClient()
prospector = Prospector(li_client)
messenger = Messenger(li_client)
publisher = Publisher(li_client)
scheduler = BackgroundScheduler()

# Track last run results
last_search_result = {}
last_followup_result = {}
last_improve_result = {}
last_publish_result = {}
started_at = None


def job_search():
    global last_search_result
    logger.info("=== Scheduled search cycle starting ===")
    last_search_result = prospector.run_search_cycle()
    last_search_result["ran_at"] = datetime.now().isoformat()


def job_followup():
    global last_followup_result
    logger.info("=== Scheduled followup cycle starting ===")
    last_followup_result = messenger.run_followup_cycle()
    last_followup_result["ran_at"] = datetime.now().isoformat()


def job_publish():
    global last_publish_result
    logger.info("=== Scheduled publish cycle starting ===")
    last_publish_result = publisher.publish_post()
    last_publish_result["ran_at"] = datetime.now().isoformat()


def job_self_improve():
    """Nightly self-improvement: analyze stats and adjust."""
    global last_improve_result
    stats = li_client.get_stats()
    recommendations = []

    if stats["total_sent"] > 20:
        rate = stats["acceptance_rate"]
        if rate < 15:
            recommendations.append("Acceptance rate very low — consider revising connection templates")
        elif rate < 25:
            recommendations.append("Acceptance rate below average — try more personalized messages")
        elif rate > 50:
            recommendations.append("Acceptance rate excellent — consider increasing daily limits slightly")

    if stats["connections_today"] < stats["daily_connection_limit"] * 0.5:
        recommendations.append("Not hitting daily limits — search may need broader targeting")

    last_improve_result = {
        "ran_at": datetime.now().isoformat(),
        "stats": stats,
        "recommendations": recommendations,
    }
    logger.info("Self-improvement analysis: %s", last_improve_result)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global started_at
    started_at = datetime.now().isoformat()

    # Login to LinkedIn
    li_client.login()

    # Schedule jobs
    scheduler.add_job(job_search, "interval", hours=2, id="search")
    scheduler.add_job(job_followup, "interval", hours=4, id="followup")
    scheduler.add_job(job_publish, "cron", hour=config.PUBLISH_HOUR_1, id="publish_morning")
    scheduler.add_job(job_publish, "cron", hour=config.PUBLISH_HOUR_2, id="publish_afternoon")
    scheduler.add_job(job_self_improve, "cron", hour=23, id="self_improve")
    scheduler.start()
    logger.info(
        "Scheduler started with jobs: search (2h), followup (4h), "
        "publish (%d:00, %d:00), self-improve (23:00)",
        config.PUBLISH_HOUR_1, config.PUBLISH_HOUR_2,
    )

    yield

    scheduler.shutdown()
    logger.info("Scheduler shut down")


app = FastAPI(title="BlackWolf LinkedIn Prospector", lifespan=lifespan)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "started_at": started_at,
        "linkedin_logged_in": li_client.is_logged_in,
        "paused": li_client.is_paused,
    }


@app.get("/status")
def status():
    return {
        "linkedin": li_client.get_stats(),
        "last_search": last_search_result,
        "last_followup": last_followup_result,
        "last_publish": last_publish_result,
        "last_improve": last_improve_result,
        "publisher": publisher.get_stats(),
        "scheduler_running": scheduler.running,
        "jobs": [
            {"id": job.id, "next_run": str(job.next_run_time)}
            for job in scheduler.get_jobs()
        ],
    }


@app.post("/search")
def trigger_search():
    """Manually trigger a search cycle."""
    result = prospector.run_search_cycle()
    global last_search_result
    last_search_result = {**result, "ran_at": datetime.now().isoformat()}
    return last_search_result


@app.post("/followup")
def trigger_followup():
    """Manually trigger a follow-up cycle."""
    result = messenger.run_followup_cycle()
    global last_followup_result
    last_followup_result = {**result, "ran_at": datetime.now().isoformat()}
    return last_followup_result


@app.post("/publish")
def trigger_publish():
    """Manually trigger a post publication."""
    result = publisher.publish_post()
    global last_publish_result
    last_publish_result = {**result, "ran_at": datetime.now().isoformat()}
    return last_publish_result


@app.post("/pause")
def pause():
    """Pause all LinkedIn activity."""
    li_client.pause()
    return {"status": "paused"}


@app.post("/resume")
def resume():
    """Resume LinkedIn activity."""
    li_client.resume()
    return {"status": "resumed"}


@app.post("/cookies")
def upload_cookies(cookies: list = Body(...)):
    """Upload LinkedIn cookies and re-login. Export cookies from browser as JSON array."""
    cookie_path = config.LINKEDIN_COOKIES_PATH
    os.makedirs(os.path.dirname(cookie_path), exist_ok=True)
    with open(cookie_path, "w") as f:
        json.dump(cookies, f)
    logger.info("Cookies saved to %s, attempting re-login...", cookie_path)
    success = li_client._login_with_cookies()
    return {
        "status": "ok" if success else "failed",
        "logged_in": li_client.is_logged_in,
    }


@app.post("/relogin")
def relogin():
    """Force a re-login attempt (tries password first, then cookies)."""
    success = li_client.login()
    return {
        "status": "ok" if success else "failed",
        "logged_in": li_client.is_logged_in,
    }
