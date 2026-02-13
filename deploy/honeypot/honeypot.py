"""
Honeypot Sensor → BlackWolf SOC

Exposes fake SSH (2222) and HTTP (8443) services.
Any connection = confirmed attack with high severity.
"""

import asyncio
import json
import logging
import os
import signal
import sys
import time
import threading
from datetime import datetime, timezone

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SSH_PORT = int(os.getenv("HONEYPOT_SSH_PORT", "2222"))
HTTP_PORT = int(os.getenv("HONEYPOT_HTTP_PORT", "8443"))
# Extra trap ports for common scan targets
FTP_PORT = int(os.getenv("HONEYPOT_FTP_PORT", "2121"))
TELNET_PORT = int(os.getenv("HONEYPOT_TELNET_PORT", "2323"))
SMTP_PORT = int(os.getenv("HONEYPOT_SMTP_PORT", "2525"))
MYSQL_PORT = int(os.getenv("HONEYPOT_MYSQL_PORT", "13306"))
RDP_PORT = int(os.getenv("HONEYPOT_RDP_PORT", "13389"))
SOC_API_URL = os.getenv("SOC_API_URL", "http://backend:8080/api/v1")
SOC_API_KEY = os.getenv("SOC_API_KEY", "")
SOC_COMPANY_ID = os.getenv("SOC_COMPANY_ID", "")
SOC_SENSOR_ID = os.getenv("SOC_SENSOR_ID", "sensor-honeypot")
BATCH_INTERVAL = int(os.getenv("BRIDGE_BATCH_INTERVAL", "10"))
HOST_IP = os.getenv("HOST_IP", "192.168.1.39")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("honeypot")

# ---------------------------------------------------------------------------
# Threat collection (thread-safe)
# ---------------------------------------------------------------------------
_batch_lock = threading.Lock()
_batch: list[dict] = []


def add_threat(threat: dict):
    with _batch_lock:
        _batch.append(threat)


def drain_batch() -> list[dict]:
    with _batch_lock:
        drained = _batch.copy()
        _batch.clear()
    return drained


# ---------------------------------------------------------------------------
# SSH Honeypot
# ---------------------------------------------------------------------------
SSH_BANNER = b"SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6\r\n"

# Fake HTML login page
HTTP_LOGIN_PAGE = b"""HTTP/1.1 200 OK\r
Content-Type: text/html\r
Server: Apache/2.4.57\r
Connection: close\r
\r
<!DOCTYPE html>
<html><head><title>Admin Panel</title></head>
<body>
<h1>System Administration</h1>
<form method="POST" action="/login">
<label>Username:</label><input name="user" type="text"><br>
<label>Password:</label><input name="pass" type="password"><br>
<button type="submit">Login</button>
</form>
</body></html>
"""

HTTP_401 = b"HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nInvalid credentials.\n"


async def handle_ssh(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    """Handle a connection to the SSH honeypot."""
    peer = writer.get_extra_info("peername")
    src_ip = peer[0] if peer else "unknown"
    src_port = peer[1] if peer else 0
    log.info("[SSH] Connection from %s:%d", src_ip, src_port)

    try:
        writer.write(SSH_BANNER)
        await writer.drain()

        # Read client banner + any auth attempts
        data = b""
        try:
            data = await asyncio.wait_for(reader.read(4096), timeout=30)
        except (asyncio.TimeoutError, ConnectionResetError):
            pass

        description = f"[Honeypot:SSH] Connection from {src_ip}:{src_port}"
        if data:
            # Try to extract username from data
            text = data.decode("utf-8", errors="replace")
            description += f" | data: {text[:200]}"

        add_threat({
            "threat_type": "BRUTE_FORCE",
            "severity": 9,
            "src_ip": src_ip,
            "dst_ip": HOST_IP,
            "dst_port": SSH_PORT,
            "description": description,
        })

    except Exception as exc:
        log.debug("[SSH] Error handling %s: %s", src_ip, exc)
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass


async def handle_http(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    """Handle a connection to the HTTP honeypot."""
    peer = writer.get_extra_info("peername")
    src_ip = peer[0] if peer else "unknown"
    src_port = peer[1] if peer else 0
    log.info("[HTTP] Connection from %s:%d", src_ip, src_port)

    try:
        data = b""
        try:
            data = await asyncio.wait_for(reader.read(8192), timeout=15)
        except (asyncio.TimeoutError, ConnectionResetError):
            pass

        request_text = data.decode("utf-8", errors="replace") if data else ""
        first_line = request_text.split("\n")[0].strip() if request_text else "empty"

        # Classify the request
        threat_type = "RECONNAISSANCE"
        severity = 7
        description = f"[Honeypot:HTTP] {first_line} from {src_ip}"

        req_lower = request_text.lower()

        # Check for web attacks in the request
        if any(kw in req_lower for kw in ["union select", "' or ", "1=1", "; drop", "sqlmap"]):
            threat_type = "SQL_INJECTION"
            severity = 9
            description = f"[Honeypot:HTTP] SQL injection attempt from {src_ip}: {first_line}"
        elif any(kw in req_lower for kw in ["<script", "javascript:", "onerror=", "onload="]):
            threat_type = "XSS"
            severity = 8
            description = f"[Honeypot:HTTP] XSS attempt from {src_ip}: {first_line}"
        elif any(kw in req_lower for kw in ["../", "..\\", "/etc/passwd", "/etc/shadow"]):
            threat_type = "EXPLOIT"
            severity = 8
            description = f"[Honeypot:HTTP] Path traversal from {src_ip}: {first_line}"
        elif any(kw in req_lower for kw in ["nikto", "dirb", "gobuster", "nuclei", "nmap", "sqlmap", "wpscan"]):
            threat_type = "RECONNAISSANCE"
            severity = 8
            description = f"[Honeypot:HTTP] Scanner detected from {src_ip}: {first_line}"
        elif "post" in req_lower[:10]:
            threat_type = "BRUTE_FORCE"
            severity = 8
            description = f"[Honeypot:HTTP] Login attempt from {src_ip}: {first_line}"

        # Send response
        if "post" in first_line.lower():
            writer.write(HTTP_401)
        else:
            writer.write(HTTP_LOGIN_PAGE)
        await writer.drain()

        add_threat({
            "threat_type": threat_type,
            "severity": severity,
            "src_ip": src_ip,
            "dst_ip": HOST_IP,
            "dst_port": HTTP_PORT,
            "description": description,
        })

    except Exception as exc:
        log.debug("[HTTP] Error handling %s: %s", src_ip, exc)
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Generic TCP trap (FTP, Telnet, SMTP, MySQL, RDP)
# ---------------------------------------------------------------------------
TRAP_BANNERS = {
    "ftp": b"220 FTP Server ready.\r\n",
    "telnet": b"\xff\xfd\x18\xff\xfd\x20\xff\xfd\x23\xff\xfd\x27\r\nLogin: ",
    "smtp": b"220 mail.local ESMTP Postfix\r\n",
    "mysql": b"\x4a\x00\x00\x00\x0a\x38\x2e\x30\x2e\x33\x36\x00",  # MySQL 8.0.36 greeting stub
    "rdp": b"\x03\x00\x00\x13\x0e\xd0\x00\x00\x00\x00\x00\x02\x00\x08\x00\x00\x00\x00\x00",
}

TRAP_THREAT_TYPES = {
    "ftp": ("RECONNAISSANCE", 7, "FTP"),
    "telnet": ("RECONNAISSANCE", 8, "Telnet"),
    "smtp": ("RECONNAISSANCE", 6, "SMTP"),
    "mysql": ("RECONNAISSANCE", 8, "MySQL"),
    "rdp": ("BRUTE_FORCE", 8, "RDP"),
}


async def handle_trap(reader: asyncio.StreamReader, writer: asyncio.StreamWriter, service: str, port: int):
    """Generic honeypot handler for any TCP service."""
    peer = writer.get_extra_info("peername")
    src_ip = peer[0] if peer else "unknown"
    src_port = peer[1] if peer else 0
    log.info("[%s] Connection from %s:%d", service.upper(), src_ip, src_port)

    try:
        # Send banner
        banner = TRAP_BANNERS.get(service, b"")
        if banner:
            writer.write(banner)
            await writer.drain()

        # Read whatever the scanner sends
        data = b""
        try:
            data = await asyncio.wait_for(reader.read(4096), timeout=15)
        except (asyncio.TimeoutError, ConnectionResetError):
            pass

        threat_type, severity, label = TRAP_THREAT_TYPES.get(service, ("RECONNAISSANCE", 7, service))
        text = data.decode("utf-8", errors="replace")[:200] if data else ""
        description = f"[Honeypot:{label}] Connection from {src_ip}:{src_port}"
        if text:
            description += f" | data: {text}"

        # Detect brute force patterns in captured data
        if data and any(kw in text.lower() for kw in ["user", "pass", "login", "auth"]):
            threat_type = "BRUTE_FORCE"
            severity = max(severity, 8)

        add_threat({
            "threat_type": threat_type,
            "severity": severity,
            "src_ip": src_ip,
            "dst_ip": HOST_IP,
            "dst_port": port,
            "description": description,
        })

    except Exception as exc:
        log.debug("[%s] Error handling %s: %s", service.upper(), src_ip, exc)
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# SOC API sender (runs in a background thread)
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


shutdown_event = threading.Event()


def batch_sender_loop():
    """Background thread that flushes batches to SOC API."""
    while not shutdown_event.is_set():
        shutdown_event.wait(timeout=BATCH_INTERVAL)
        threats = drain_batch()
        if threats:
            send_batch(threats)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run_servers():
    ssh_server = await asyncio.start_server(handle_ssh, "0.0.0.0", SSH_PORT)
    http_server = await asyncio.start_server(handle_http, "0.0.0.0", HTTP_PORT)

    log.info("SSH  honeypot listening on :%d", SSH_PORT)
    log.info("HTTP honeypot listening on :%d", HTTP_PORT)

    # Extra trap services
    trap_servers = []
    trap_configs = [
        ("ftp", FTP_PORT),
        ("telnet", TELNET_PORT),
        ("smtp", SMTP_PORT),
        ("mysql", MYSQL_PORT),
        ("rdp", RDP_PORT),
    ]
    for service, port in trap_configs:
        try:
            handler = lambda r, w, s=service, p=port: handle_trap(r, w, s, p)
            server = await asyncio.start_server(handler, "0.0.0.0", port)
            trap_servers.append(server)
            log.info("%s honeypot listening on :%d", service.upper(), port)
        except OSError as e:
            log.warning("Could not start %s trap on :%d: %s", service, port, e)

    stop = asyncio.Event()
    loop = asyncio.get_event_loop()

    def _stop():
        stop.set()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _stop)

    await stop.wait()

    ssh_server.close()
    http_server.close()
    await ssh_server.wait_closed()
    await http_server.wait_closed()
    for s in trap_servers:
        s.close()
        await s.wait_closed()


def main():
    log.info("Honeypot Sensor starting")
    log.info("  SSH  port : %d", SSH_PORT)
    log.info("  HTTP port : %d", HTTP_PORT)
    log.info("  FTP  port : %d", FTP_PORT)
    log.info("  TELNET port: %d", TELNET_PORT)
    log.info("  SMTP port : %d", SMTP_PORT)
    log.info("  MySQL port: %d", MYSQL_PORT)
    log.info("  RDP  port : %d", RDP_PORT)
    log.info("  Sensor ID : %s", SOC_SENSOR_ID)

    if not SOC_API_KEY or not SOC_COMPANY_ID:
        log.error("SOC_API_KEY and SOC_COMPANY_ID must be set")
        sys.exit(1)

    # Register sensor as online
    log.info("Registering sensor with SOC backend...")
    send_batch([], register=True)

    # Start batch sender thread
    sender = threading.Thread(target=batch_sender_loop, daemon=True)
    sender.start()

    try:
        asyncio.run(run_servers())
    finally:
        # Flush final batch
        shutdown_event.set()
        remaining = drain_batch()
        if remaining:
            log.info("Flushing final batch of %d threats...", len(remaining))
            send_batch(remaining)
        log.info("Honeypot stopped")


if __name__ == "__main__":
    main()
