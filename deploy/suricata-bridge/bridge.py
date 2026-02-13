"""
Suricata EVE JSON → BlackWolf SOC Bridge

Tails Suricata's eve.json log and forwards alerts to the SOC platform
via POST /api/v1/sensors/upload in configurable batches.
"""

import json
import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Configuration (env vars)
# ---------------------------------------------------------------------------
EVE_JSON_PATH = os.getenv("EVE_JSON_PATH", "/var/log/suricata/eve.json")
SOC_API_URL = os.getenv("SOC_API_URL", "http://backend:8080/api/v1")
SOC_API_KEY = os.getenv("SOC_API_KEY", "")
SOC_COMPANY_ID = os.getenv("SOC_COMPANY_ID", "")
SOC_SENSOR_ID = os.getenv("SOC_SENSOR_ID", "sensor-suricata-ids")
BRIDGE_BATCH_INTERVAL = int(os.getenv("BRIDGE_BATCH_INTERVAL", "10"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("suricata-bridge")

# ---------------------------------------------------------------------------
# Suricata category → SOC threat_type mapping
# ---------------------------------------------------------------------------
CATEGORY_MAP: dict[str, str] = {
    # Scanning / Recon
    "Network Scan": "PORT_SCAN",
    "Detection of a Network Scan": "PORT_SCAN",
    "Attempted Information Leak": "RECONNAISSANCE",
    "Information Leak": "RECONNAISSANCE",
    # Brute force / Auth
    "Attempted Administrator Privilege Gain": "BRUTE_FORCE",
    "Unsuccessful User Privilege Gain": "BRUTE_FORCE",
    "Successful Administrator Privilege Gain": "PRIVILEGE_ESCALATION",
    "Successful User Privilege Gain": "PRIVILEGE_ESCALATION",
    # Malware
    "A Network Trojan was detected": "MALWARE",
    "Potential Corporate Privacy Violation": "MALWARE",
    # C2
    "Malware Command and Control Activity Detected": "C2",
    # DoS
    "Denial of Service": "DOS",
    "Detection of a Denial of Service Attack": "DOS",
    # Web attacks
    "Web Application Attack": "SQL_INJECTION",
    # Exploits
    "Executable Code was Detected": "EXPLOIT",
    "Attempted User Privilege Gain": "PRIVILEGE_ESCALATION",
    # Policy
    "Potentially Bad Traffic": "RECONNAISSANCE",
    "Misc Attack": "EXPLOIT",
    "Not Suspicious Traffic": "RECONNAISSANCE",
    "Generic Protocol Command Decode": "RECONNAISSANCE",
}

# Keyword overrides applied to the signature message
KEYWORD_OVERRIDES: list[tuple[list[str], str]] = [
    (["nmap", "scan", "masscan", "zmap"], "PORT_SCAN"),
    (["brute", "login attempt", "ssh auth", "authentication failure"], "BRUTE_FORCE"),
    (["trojan", "malware", "backdoor", "rat "], "MALWARE"),
    (["command and control", "c2 ", "beacon", "cobalt"], "C2"),
    (["dos ", "ddos", "flood", "amplification"], "DOS"),
    (["sqli", "sql injection", "union select", "xss", "script>"], "SQL_INJECTION"),
    (["exploit", "shellcode", "overflow", "rce "], "EXPLOIT"),
    (["privilege", "escalat", "sudo", "setuid"], "PRIVILEGE_ESCALATION"),
    (["lateral", "psexec", "wmi ", "pass.the.hash"], "LATERAL_MOVEMENT"),
]


def map_threat_type(category: str | None, signature: str | None) -> str:
    """Map Suricata alert category + signature to a SOC threat_type."""
    sig_lower = (signature or "").lower()

    # Keyword overrides take priority
    for keywords, threat_type in KEYWORD_OVERRIDES:
        for kw in keywords:
            if kw in sig_lower:
                return threat_type

    # Category-based mapping
    if category and category in CATEGORY_MAP:
        return CATEGORY_MAP[category]

    return "RECONNAISSANCE"


# ---------------------------------------------------------------------------
# Severity mapping  (Suricata priority 1=high → SOC 1-10 scale)
# ---------------------------------------------------------------------------
HIGH_SEVERITY_TYPES = {"MALWARE", "C2", "EXPLOIT", "PRIVILEGE_ESCALATION"}
MED_SEVERITY_TYPES = {"BRUTE_FORCE", "SQL_INJECTION", "DOS", "LATERAL_MOVEMENT"}


def map_severity(priority: int | None, threat_type: str) -> int:
    """Convert Suricata priority (1-3) to SOC severity (1-10)."""
    pri = priority if priority and 1 <= priority <= 3 else 2

    if pri == 1:
        return 10 if threat_type in HIGH_SEVERITY_TYPES else 9
    if pri == 2:
        if threat_type in HIGH_SEVERITY_TYPES:
            return 8
        if threat_type in MED_SEVERITY_TYPES:
            return 7
        return 6
    # pri == 3
    if threat_type in HIGH_SEVERITY_TYPES:
        return 5
    if threat_type in MED_SEVERITY_TYPES:
        return 4
    return 3


# ---------------------------------------------------------------------------
# EVE JSON parsing
# ---------------------------------------------------------------------------

def parse_alert(line: str) -> dict | None:
    """Parse one EVE JSON line and return a SOC-ready dict, or None."""
    try:
        evt = json.loads(line)
    except json.JSONDecodeError:
        return None

    if evt.get("event_type") != "alert":
        return None

    alert = evt.get("alert", {})
    category = alert.get("category", "")
    signature = alert.get("signature", "")
    priority = alert.get("severity")  # Suricata calls it "severity" in EVE

    threat_type = map_threat_type(category, signature)
    severity = map_severity(priority, threat_type)

    src_ip = evt.get("src_ip", "0.0.0.0")
    dst_ip = evt.get("dest_ip", "0.0.0.0")
    dst_port = evt.get("dest_port", 0)

    sid = alert.get("signature_id", 0)
    description = f"[SID:{sid}] {signature}"
    if category:
        description += f" ({category})"

    return {
        "threat_type": threat_type,
        "severity": severity,
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "dst_port": dst_port,
        "description": description,
    }


# ---------------------------------------------------------------------------
# Tail with inode-based rotation detection
# ---------------------------------------------------------------------------

class EveTailer:
    """Tail eve.json, detecting log rotation via inode change."""

    def __init__(self, path: str):
        self.path = path
        self._fh = None
        self._inode = None

    def open(self):
        """Open the file and seek to end (skip historical data)."""
        self._fh = open(self.path, "r")
        self._inode = os.stat(self.path).st_ino
        self._fh.seek(0, 2)  # seek to EOF
        log.info("Opened %s (inode=%d), seeked to end", self.path, self._inode)

    def readlines(self) -> list[str]:
        """Read new lines, reopening if the file was rotated."""
        if self._fh is None:
            return []

        # Check for rotation
        try:
            current_inode = os.stat(self.path).st_ino
        except FileNotFoundError:
            return []

        if current_inode != self._inode:
            log.info("Log rotation detected (inode %d -> %d), reopening",
                     self._inode, current_inode)
            self._fh.close()
            self._fh = open(self.path, "r")
            self._inode = current_inode
            # Read from beginning of new file

        lines = self._fh.readlines()
        return lines

    def close(self):
        if self._fh:
            self._fh.close()
            self._fh = None


# ---------------------------------------------------------------------------
# SOC API client
# ---------------------------------------------------------------------------

def send_batch(threats: list[dict], flow_count: int) -> bool:
    """POST a batch of threats to the SOC sensor upload endpoint."""
    if not threats:
        return True

    payload = {
        "company_id": SOC_COMPANY_ID,
        "sensor_id": SOC_SENSOR_ID,
        "api_key": SOC_API_KEY,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "threats": threats,
        "packets": [],
        "stats": {
            "alerts_in_batch": len(threats),
            "flows_observed": flow_count,
        },
    }

    url = f"{SOC_API_URL}/sensors/upload"
    try:
        resp = requests.post(url, json=payload, timeout=15)
        if resp.status_code == 200:
            body = resp.json()
            log.info(
                "Batch sent: %d threats → %s (processed_threats=%s)",
                len(threats),
                body.get("status"),
                body.get("processed_threats"),
            )
            return True
        else:
            log.warning("SOC API returned %d: %s", resp.status_code, resp.text[:500])
            return False
    except requests.RequestException as exc:
        log.error("Failed to send batch: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

shutdown_requested = False


def handle_signal(signum, _frame):
    global shutdown_requested
    sig_name = signal.Signals(signum).name
    log.info("Received %s, initiating graceful shutdown...", sig_name)
    shutdown_requested = True


def wait_for_file(path: str):
    """Block until the EVE JSON file exists."""
    log.info("Waiting for %s to appear...", path)
    while not shutdown_requested:
        if Path(path).exists():
            log.info("Found %s", path)
            return
        time.sleep(2)


def main():
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    log.info("Suricata Bridge starting")
    log.info("  EVE path   : %s", EVE_JSON_PATH)
    log.info("  SOC API    : %s", SOC_API_URL)
    log.info("  Sensor ID  : %s", SOC_SENSOR_ID)
    log.info("  Batch interval: %ds", BRIDGE_BATCH_INTERVAL)

    if not SOC_API_KEY or not SOC_COMPANY_ID:
        log.error("SOC_API_KEY and SOC_COMPANY_ID must be set")
        sys.exit(1)

    wait_for_file(EVE_JSON_PATH)
    if shutdown_requested:
        return

    tailer = EveTailer(EVE_JSON_PATH)
    tailer.open()

    batch: list[dict] = []
    flow_count = 0
    last_flush = time.monotonic()

    try:
        while not shutdown_requested:
            lines = tailer.readlines()

            for line in lines:
                line = line.strip()
                if not line:
                    continue

                # Count flows for stats
                try:
                    evt = json.loads(line)
                    if evt.get("event_type") == "flow":
                        flow_count += 1
                        continue
                except json.JSONDecodeError:
                    continue

                threat = parse_alert(line)
                if threat:
                    batch.append(threat)

            # Flush batch on interval
            now = time.monotonic()
            if now - last_flush >= BRIDGE_BATCH_INTERVAL:
                if batch:
                    send_batch(batch, flow_count)
                    batch = []
                    flow_count = 0
                last_flush = now

            # Small sleep to avoid busy-waiting
            time.sleep(0.5)

    finally:
        # Graceful shutdown: flush remaining batch
        if batch:
            log.info("Flushing final batch of %d threats...", len(batch))
            send_batch(batch, flow_count)
        tailer.close()
        log.info("Suricata Bridge stopped")


if __name__ == "__main__":
    main()
