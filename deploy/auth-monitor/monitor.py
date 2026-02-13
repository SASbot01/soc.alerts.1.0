"""
Auth Log Monitor → BlackWolf SOC

Tails /var/log/auth.log and detects:
- SSH brute force (failed password, invalid user)
- Privilege escalation (sudo failures, su attempts)
- Unauthorized access patterns
"""

import json
import logging
import os
import re
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
AUTH_LOG_PATH = os.getenv("AUTH_LOG_PATH", "/var/log/auth.log")
SOC_API_URL = os.getenv("SOC_API_URL", "http://backend:8080/api/v1")
SOC_API_KEY = os.getenv("SOC_API_KEY", "")
SOC_COMPANY_ID = os.getenv("SOC_COMPANY_ID", "")
SOC_SENSOR_ID = os.getenv("SOC_SENSOR_ID", "sensor-auth-monitor")
BATCH_INTERVAL = int(os.getenv("BRIDGE_BATCH_INTERVAL", "10"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("auth-monitor")

# ---------------------------------------------------------------------------
# Detection patterns
# ---------------------------------------------------------------------------
PATTERNS = [
    # SSH brute force
    {
        "regex": re.compile(
            r"Failed password for (?:invalid user )?(\S+) from (\S+) port (\d+)"
        ),
        "threat_type": "BRUTE_FORCE",
        "severity": 7,
        "desc": "SSH failed password",
    },
    {
        "regex": re.compile(r"Invalid user (\S+) from (\S+) port (\d+)"),
        "threat_type": "BRUTE_FORCE",
        "severity": 7,
        "desc": "SSH invalid user",
    },
    {
        "regex": re.compile(
            r"pam_unix\(sshd:auth\): authentication failure.*rhost=(\S+)(?:\s+user=(\S+))?"
        ),
        "threat_type": "BRUTE_FORCE",
        "severity": 6,
        "desc": "SSH PAM authentication failure",
    },
    {
        "regex": re.compile(
            r"maximum authentication attempts exceeded for (?:invalid user )?(\S+) from (\S+)"
        ),
        "threat_type": "BRUTE_FORCE",
        "severity": 8,
        "desc": "SSH max auth attempts exceeded",
    },
    # Connection closed by authenticating user (pre-auth disconnect = scan)
    {
        "regex": re.compile(
            r"Connection closed by authenticating user \S+ (\S+) port (\d+)"
        ),
        "threat_type": "RECONNAISSANCE",
        "severity": 4,
        "desc": "SSH pre-auth connection closed",
    },
    # Sudo abuse
    {
        "regex": re.compile(
            r"sudo:.*\s(\S+)\s:.*command not allowed.*COMMAND=(.*)"
        ),
        "threat_type": "PRIVILEGE_ESCALATION",
        "severity": 8,
        "desc": "Sudo command denied",
    },
    {
        "regex": re.compile(
            r"sudo:\s+(\S+)\s:.*authentication failure"
        ),
        "threat_type": "PRIVILEGE_ESCALATION",
        "severity": 7,
        "desc": "Sudo authentication failure",
    },
    # su failures
    {
        "regex": re.compile(
            r"su:\s+(?:FAILED SU|pam_authenticate: Authentication failure).*by\s+(\S+)"
        ),
        "threat_type": "PRIVILEGE_ESCALATION",
        "severity": 7,
        "desc": "su authentication failure",
    },
    # BREAK-IN ATTEMPT
    {
        "regex": re.compile(r"POSSIBLE BREAK-IN ATTEMPT.*from (\S+)"),
        "threat_type": "UNAUTHORIZED_ACCESS",
        "severity": 9,
        "desc": "Possible break-in attempt",
    },
    # Accepted but from unusual = informational
    {
        "regex": re.compile(
            r"Accepted (?:password|publickey) for (\S+) from (\S+) port (\d+)"
        ),
        "threat_type": None,  # Not a threat, just tracking
        "severity": 0,
        "desc": "Successful login",
    },
]


def parse_line(line: str) -> dict | None:
    """Parse an auth.log line into a SOC threat dict."""
    for pattern in PATTERNS:
        m = pattern["regex"].search(line)
        if not m:
            continue

        # Skip non-threat entries
        if pattern["threat_type"] is None:
            return None

        groups = m.groups()
        src_ip = "127.0.0.1"
        dst_port = 22

        # Extract IP from matched groups
        for g in groups:
            if g and re.match(r"\d+\.\d+\.\d+\.\d+", g):
                src_ip = g
                break

        # Extract port if available
        for g in groups:
            if g and g.isdigit() and int(g) > 1024:
                dst_port = int(g)
                break

        user = groups[0] if groups else "unknown"

        return {
            "threat_type": pattern["threat_type"],
            "severity": pattern["severity"],
            "src_ip": src_ip,
            "dst_ip": "192.168.1.39",
            "dst_port": dst_port,
            "description": f"[AuthLog] {pattern['desc']}: user={user} from {src_ip}",
        }

    return None


# ---------------------------------------------------------------------------
# Log tailer with rotation detection
# ---------------------------------------------------------------------------

class LogTailer:
    def __init__(self, path: str):
        self.path = path
        self._fh = None
        self._inode = None

    def open(self):
        self._fh = open(self.path, "r")
        self._inode = os.stat(self.path).st_ino
        self._fh.seek(0, 2)
        log.info("Opened %s (inode=%d), seeked to end", self.path, self._inode)

    def readlines(self) -> list[str]:
        if self._fh is None:
            return []
        try:
            current_inode = os.stat(self.path).st_ino
        except FileNotFoundError:
            return []
        if current_inode != self._inode:
            log.info("Log rotation detected, reopening")
            self._fh.close()
            self._fh = open(self.path, "r")
            self._inode = current_inode
        return self._fh.readlines()

    def close(self):
        if self._fh:
            self._fh.close()
            self._fh = None


# ---------------------------------------------------------------------------
# SOC API
# ---------------------------------------------------------------------------

def send_batch(threats: list[dict], register: bool = False) -> bool:
    if not threats and not register:
        return True
    payload = {
        "company_id": SOC_COMPANY_ID,
        "sensor_id": SOC_SENSOR_ID,
        "api_key": SOC_API_KEY,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "threats": threats,
        "packets": [],
        "stats": {"alerts_in_batch": len(threats)},
    }
    url = f"{SOC_API_URL}/sensors/upload"
    try:
        resp = requests.post(url, json=payload, timeout=15)
        if resp.status_code == 200:
            log.info("Batch sent: %d threats → success", len(threats))
            return True
        log.warning("SOC API returned %d: %s", resp.status_code, resp.text[:500])
        return False
    except requests.RequestException as exc:
        log.error("Failed to send batch: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

shutdown_requested = False


def handle_signal(signum, _frame):
    global shutdown_requested
    log.info("Received %s, shutting down...", signal.Signals(signum).name)
    shutdown_requested = True


def main():
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    log.info("Auth Log Monitor starting")
    log.info("  Log path : %s", AUTH_LOG_PATH)
    log.info("  Sensor ID: %s", SOC_SENSOR_ID)

    if not SOC_API_KEY or not SOC_COMPANY_ID:
        log.error("SOC_API_KEY and SOC_COMPANY_ID must be set")
        sys.exit(1)

    log.info("Waiting for %s ...", AUTH_LOG_PATH)
    while not shutdown_requested and not Path(AUTH_LOG_PATH).exists():
        time.sleep(2)
    if shutdown_requested:
        return

    tailer = LogTailer(AUTH_LOG_PATH)
    tailer.open()

    # Register sensor as online
    log.info("Registering sensor with SOC backend...")
    send_batch([], register=True)

    batch: list[dict] = []
    last_flush = time.monotonic()

    try:
        while not shutdown_requested:
            for line in tailer.readlines():
                threat = parse_line(line.strip())
                if threat:
                    batch.append(threat)

            now = time.monotonic()
            if now - last_flush >= BATCH_INTERVAL:
                if batch:
                    send_batch(batch)
                    batch = []
                last_flush = now

            time.sleep(0.5)
    finally:
        if batch:
            log.info("Flushing final batch of %d threats...", len(batch))
            send_batch(batch)
        tailer.close()
        log.info("Auth Log Monitor stopped")


if __name__ == "__main__":
    main()
