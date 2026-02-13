"""
Nginx Access Log Monitor → BlackWolf SOC

Tails Nginx access logs and detects:
- SQL injection attempts
- XSS payloads
- Path traversal
- Known scanner user-agents
- Suspicious request floods (4xx)
"""

import logging
import os
import re
import signal
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
ACCESS_LOG_PATH = os.getenv("ACCESS_LOG_PATH", "/var/log/nginx/access.log")
SOC_API_URL = os.getenv("SOC_API_URL", "http://backend:8080/api/v1")
SOC_API_KEY = os.getenv("SOC_API_KEY", "")
SOC_COMPANY_ID = os.getenv("SOC_COMPANY_ID", "")
SOC_SENSOR_ID = os.getenv("SOC_SENSOR_ID", "sensor-nginx-waf")
BATCH_INTERVAL = int(os.getenv("BRIDGE_BATCH_INTERVAL", "10"))
HOST_IP = os.getenv("HOST_IP", "192.168.1.39")
# IPs to ignore (comma-separated prefixes). With nginx real_ip enabled,
# external traffic already shows real IPs, so we only skip loopback by default.
_raw_trusted = os.getenv("TRUSTED_PREFIXES", "127.0.0.")
TRUSTED_PREFIXES = tuple(p.strip() for p in _raw_trusted.split(",") if p.strip())
# Threshold: number of 4xx responses in a window to flag as scan
SCAN_THRESHOLD = int(os.getenv("SCAN_THRESHOLD", "20"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("nginx-monitor")

# ---------------------------------------------------------------------------
# Nginx combined log format parser
# $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
# ---------------------------------------------------------------------------
NGINX_LOG_RE = re.compile(
    r'(?P<ip>\S+) - \S+ \[(?P<time>[^\]]+)\] '
    r'"(?P<method>\S+) (?P<uri>\S+) \S+" '
    r'(?P<status>\d{3}) \d+ '
    r'"(?P<referer>[^"]*)" '
    r'"(?P<ua>[^"]*)"'
)

# ---------------------------------------------------------------------------
# Attack detection patterns
# ---------------------------------------------------------------------------
SQLI_PATTERNS = re.compile(
    r"(union\s+(all\s+)?select|"
    r"'\s*(or|and)\s+['\"0-9]|"
    r";\s*(drop|delete|update|insert)\s|"
    r"(--|#|/\*)\s*$|"
    r"benchmark\s*\(|"
    r"sleep\s*\(|"
    r"load_file\s*\(|"
    r"into\s+outfile|"
    r"information_schema|"
    r"0x[0-9a-f]{8})",
    re.IGNORECASE,
)

XSS_PATTERNS = re.compile(
    r"(<script|javascript:|onerror\s*=|onload\s*=|"
    r"onfocus\s*=|onmouseover\s*=|"
    r"eval\s*\(|document\.(cookie|location)|"
    r"alert\s*\(|prompt\s*\(|confirm\s*\()",
    re.IGNORECASE,
)

TRAVERSAL_PATTERNS = re.compile(
    r"(\.\./|\.\.\\|"
    r"\.\.%2[fF]|"
    r"/etc/(passwd|shadow|hosts)|"
    r"/proc/self|"
    r"/windows/system32)",
    re.IGNORECASE,
)

SCANNER_UAS = re.compile(
    r"(nikto|nmap|dirb|dirbuster|gobuster|nuclei|sqlmap|"
    r"wpscan|masscan|zap|burpsuite|burp|acunetix|nessus|openvas|"
    r"qualys|skipfish|w3af|arachni|vega|grabber|"
    r"havij|pangolin|webscarab|"
    # Modern scanners / fuzzers
    r"feroxbuster|ffuf|wfuzz|httpx|katana|"
    r"subfinder|amass|whatweb|testssl|"
    r"joomscan|droopescan|commix|dalfox|"
    r"tplmap|arjun|paramspider|gau|"
    # Exploit frameworks
    r"metasploit|meterpreter|cobalt.?strike|"
    r"hydra|medusa|patator|"
    # Internet-wide scanners
    r"censys|shodan|zgrab|internetmeasur|"
    # Crawler/bot abuse
    r"go-http-client/|python-requests/|python-urllib|"
    r"libwww-perl|curl/|wget/|"
    r"scan_?bot|crawl_?bot|spider_?bot)",
    re.IGNORECASE,
)

SCANNER_PATHS = re.compile(
    r"(/wp-admin|/wp-login|/xmlrpc\.php|/wp-content/uploads|/wp-includes|"
    r"/phpmyadmin|/pma|/adminer(?:/|$)|/manager/html|"
    r"/\.env(?:/|$)|/\.git(?:/|$)|/\.htaccess|/\.htpasswd|/\.aws(?:/|$)|/\.ssh(?:/|$)|/\.docker(?:/|$)|"
    r"/web\.config|/database\.yml|/settings\.py|"
    r"/db\.sql|/dump\.sql|/database\.sql|"
    r"/actuator(?:/|$)|/swagger(?:/|$)|/api-docs(?:/|$)|"
    r"/solr(?:/|$)|/jenkins(?:/|$)|/jmx-console|"
    r"/server-status|/server-info|"
    r"/cgi-bin(?:/|$)|/shell\.php|/cmd\.php|/eval\.php|"
    r"/debug(?:/|$)|/trace(?:/|$)|/elmah\.axd|"
    r"/wp-json/wp/v2/users|"
    r"/vendor/phpunit|/owa(?:/|$)|/ecp(?:/|$)|/autodiscover|"
    r"/remote(?:/|$)|/vpn(?:/|$)|/sslvpn|/dana-na|/global-protect|"
    r"/Telerik|/umbraco(?:/|$)|/sitecore(?:/|$)|"
    r"/HNAP1|/sdk(?:/|$)|/cgi-bin/luci|/boaform)",
    re.IGNORECASE,
)


def analyze_request(parsed: dict) -> dict | None:
    """Analyze a parsed Nginx log entry for threats."""
    ip = parsed["ip"]

    # Skip trusted / internal Docker IPs
    if any(ip.startswith(p) for p in TRUSTED_PREFIXES):
        return None

    uri = parsed["uri"]
    ua = parsed["ua"]
    status = int(parsed["status"])
    method = parsed["method"]

    # Decode URL-encoded characters for better detection
    try:
        from urllib.parse import unquote
        uri_decoded = unquote(uri)
    except Exception:
        uri_decoded = uri

    full_req = f"{method} {uri_decoded} UA:{ua}"

    # 1. SQL Injection
    if SQLI_PATTERNS.search(uri_decoded) or SQLI_PATTERNS.search(ua):
        return {
            "threat_type": "SQL_INJECTION",
            "severity": 9,
            "src_ip": ip,
            "dst_ip": HOST_IP,
            "dst_port": 80,
            "description": f"[Nginx:WAF] SQL injection attempt: {full_req[:300]}",
        }

    # 2. XSS
    if XSS_PATTERNS.search(uri_decoded) or XSS_PATTERNS.search(ua):
        return {
            "threat_type": "XSS",
            "severity": 8,
            "src_ip": ip,
            "dst_ip": HOST_IP,
            "dst_port": 80,
            "description": f"[Nginx:WAF] XSS attempt: {full_req[:300]}",
        }

    # 3. Path traversal
    if TRAVERSAL_PATTERNS.search(uri_decoded):
        return {
            "threat_type": "EXPLOIT",
            "severity": 8,
            "src_ip": ip,
            "dst_ip": HOST_IP,
            "dst_port": 80,
            "description": f"[Nginx:WAF] Path traversal: {full_req[:300]}",
        }

    # 4. Known scanner user agents
    if SCANNER_UAS.search(ua):
        return {
            "threat_type": "RECONNAISSANCE",
            "severity": 7,
            "src_ip": ip,
            "dst_ip": HOST_IP,
            "dst_port": 80,
            "description": f"[Nginx:WAF] Scanner detected: {ua[:200]}",
        }

    # 5. Suspicious path probing
    if SCANNER_PATHS.search(uri):
        return {
            "threat_type": "RECONNAISSANCE",
            "severity": 6,
            "src_ip": ip,
            "dst_ip": HOST_IP,
            "dst_port": 80,
            "description": f"[Nginx:WAF] Suspicious path probe: {method} {uri[:200]}",
        }

    return None


# ---------------------------------------------------------------------------
# 4xx flood detection (scan detection)
# ---------------------------------------------------------------------------

class FloodDetector:
    """Detect IPs generating excessive 4xx errors (directory brute force)."""

    def __init__(self, threshold: int, window: int = 60):
        self.threshold = threshold
        self.window = window
        self._counts: dict[str, list[float]] = defaultdict(list)
        self._alerted: set[str] = set()

    def record(self, ip: str, status: int) -> dict | None:
        if status < 400 or status >= 500:
            return None

        now = time.monotonic()
        self._counts[ip].append(now)

        # Prune old entries
        cutoff = now - self.window
        self._counts[ip] = [t for t in self._counts[ip] if t > cutoff]

        count = len(self._counts[ip])
        if count >= self.threshold and ip not in self._alerted:
            self._alerted.add(ip)
            return {
                "threat_type": "RECONNAISSANCE",
                "severity": 7,
                "src_ip": ip,
                "dst_ip": HOST_IP,
                "dst_port": 80,
                "description": f"[Nginx:WAF] Directory brute force: {count} 4xx responses in {self.window}s from {ip}",
            }

        return None

    def reset_window(self):
        """Periodically reset alerted IPs to allow re-detection."""
        self._alerted.clear()


# ---------------------------------------------------------------------------
# Log tailer
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

    log.info("Nginx WAF Monitor starting")
    log.info("  Log path   : %s", ACCESS_LOG_PATH)
    log.info("  Sensor ID  : %s", SOC_SENSOR_ID)
    log.info("  Scan thresh: %d 4xx/min", SCAN_THRESHOLD)

    if not SOC_API_KEY or not SOC_COMPANY_ID:
        log.error("SOC_API_KEY and SOC_COMPANY_ID must be set")
        sys.exit(1)

    log.info("Waiting for %s ...", ACCESS_LOG_PATH)
    while not shutdown_requested and not Path(ACCESS_LOG_PATH).exists():
        time.sleep(2)
    if shutdown_requested:
        return

    tailer = LogTailer(ACCESS_LOG_PATH)
    tailer.open()

    # Register sensor as online
    log.info("Registering sensor with SOC backend...")
    send_batch([], register=True)

    flood = FloodDetector(threshold=SCAN_THRESHOLD)
    batch: list[dict] = []
    last_flush = time.monotonic()
    last_flood_reset = time.monotonic()

    try:
        while not shutdown_requested:
            for line in tailer.readlines():
                m = NGINX_LOG_RE.match(line.strip())
                if not m:
                    continue

                parsed = m.groupdict()

                # Skip trusted / internal Docker IPs for flood detection too
                ip = parsed["ip"]
                if any(ip.startswith(p) for p in TRUSTED_PREFIXES):
                    continue

                # Attack pattern detection
                threat = analyze_request(parsed)
                if threat:
                    batch.append(threat)

                # Flood detection
                flood_threat = flood.record(ip, int(parsed["status"]))
                if flood_threat:
                    batch.append(flood_threat)

            now = time.monotonic()

            # Flush batch
            if now - last_flush >= BATCH_INTERVAL:
                if batch:
                    send_batch(batch)
                    batch = []
                last_flush = now

            # Reset flood detector every 5 minutes
            if now - last_flood_reset >= 300:
                flood.reset_window()
                last_flood_reset = now

            time.sleep(0.5)

    finally:
        if batch:
            log.info("Flushing final batch of %d threats...", len(batch))
            send_batch(batch)
        tailer.close()
        log.info("Nginx WAF Monitor stopped")


if __name__ == "__main__":
    main()
