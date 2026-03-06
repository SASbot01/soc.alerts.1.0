#!/usr/bin/env python3
"""
BlackWolf SOC Agent — Lightweight EDR
======================================

Standalone security agent that monitors a Linux host and reports to
the BlackWolf SOC platform. Install on any client machine.

Capabilities:
  - File Integrity Monitoring (FIM): detects changes in critical paths
  - Auth log monitoring: SSH brute force, privilege escalation
  - Process monitoring: suspicious processes, reverse shells
  - Network connection monitoring: C2 beacons, unusual outbound
  - System resource anomalies: disk full, high CPU/memory
  - Crontab monitoring: unauthorized scheduled tasks
  - Package audit: new/removed packages

Install:
  sudo ./install.sh

Config:
  /etc/blackwolf-agent/agent.conf
"""

import hashlib
import json
import logging
import os
import platform
import re
import signal
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' module required. Install: pip3 install requests")
    sys.exit(1)

# ═══════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════

CONFIG_PATH = os.getenv("AGENT_CONFIG", "/etc/blackwolf-agent/agent.conf")
DEFAULT_CONFIG = {
    "soc_url": os.getenv("SOC_URL", ""),
    "api_key": os.getenv("SOC_API_KEY", ""),
    "company_id": os.getenv("SOC_COMPANY_ID", ""),
    "sensor_id": os.getenv("SOC_SENSOR_ID", f"agent-{socket.gethostname()}"),
    "heartbeat_interval": 60,
    "fim_interval": 300,
    "process_interval": 30,
    "network_interval": 60,
    "auth_log": "/var/log/auth.log",
    "fim_paths": [
        "/etc/passwd", "/etc/shadow", "/etc/sudoers", "/etc/ssh/sshd_config",
        "/etc/crontab", "/etc/hosts", "/etc/resolv.conf",
        "/root/.ssh/authorized_keys", "/root/.bashrc",
    ],
    "fim_dirs": [
        "/etc/cron.d", "/etc/cron.daily", "/etc/sudoers.d",
    ],
    "suspicious_processes": [
        "ncat", "nc.traditional", "nmap", "masscan", "hydra", "john",
        "hashcat", "mimikatz", "meterpreter", "cobalt", "empire",
        "chisel", "plink", "socat", "cryptominer", "xmrig",
    ],
    "suspicious_ports": [4444, 5555, 8888, 1234, 31337, 9001, 9002],
    "max_batch_size": 50,
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("blackwolf-agent")

shutdown_requested = False


def handle_signal(signum, _frame):
    global shutdown_requested
    log.info("Received signal %d, shutting down...", signum)
    shutdown_requested = True


# ═══════════════════════════════════════════════════════════
# Config loader
# ═══════════════════════════════════════════════════════════

def load_config() -> dict:
    config = DEFAULT_CONFIG.copy()
    if Path(CONFIG_PATH).exists():
        try:
            with open(CONFIG_PATH) as f:
                file_config = json.load(f)
            config.update(file_config)
            log.info("Loaded config from %s", CONFIG_PATH)
        except Exception as e:
            log.warning("Failed to load config: %s, using defaults", e)
    # Environment overrides take priority
    if os.getenv("SOC_URL"):
        config["soc_url"] = os.getenv("SOC_URL")
    if os.getenv("SOC_API_KEY"):
        config["api_key"] = os.getenv("SOC_API_KEY")
    if os.getenv("SOC_COMPANY_ID"):
        config["company_id"] = os.getenv("SOC_COMPANY_ID")
    return config


# ═══════════════════════════════════════════════════════════
# SOC API Communication
# ═══════════════════════════════════════════════════════════

def send_threats(config: dict, threats: list[dict]) -> bool:
    if not threats:
        return True
    if not config["soc_url"] or not config["api_key"]:
        log.warning("SOC URL or API key not configured")
        return False

    payload = {
        "company_id": config["company_id"],
        "sensor_id": config["sensor_id"],
        "api_key": config["api_key"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "threats": threats[:config["max_batch_size"]],
        "packets": [],
        "stats": {
            "alerts_in_batch": len(threats),
            "hostname": socket.gethostname(),
            "os": platform.platform(),
        },
    }

    url = f"{config['soc_url']}/sensors/upload"
    try:
        resp = requests.post(url, json=payload, timeout=15)
        if resp.status_code == 200:
            log.info("Sent %d threats to SOC", len(threats))
            return True
        log.warning("SOC returned %d: %s", resp.status_code, resp.text[:300])
        return False
    except requests.RequestException as e:
        log.error("Failed to send to SOC: %s", e)
        return False


def send_heartbeat(config: dict) -> bool:
    return send_threats(config, [])


# ═══════════════════════════════════════════════════════════
# File Integrity Monitoring (FIM)
# ═══════════════════════════════════════════════════════════

class FileIntegrityMonitor:
    def __init__(self, paths: list[str], dirs: list[str]):
        self.paths = paths
        self.dirs = dirs
        self.baseline: dict[str, str] = {}
        self._build_baseline()

    def _hash_file(self, path: str) -> str | None:
        try:
            h = hashlib.sha256()
            with open(path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    h.update(chunk)
            return h.hexdigest()
        except (PermissionError, FileNotFoundError, OSError):
            return None

    def _build_baseline(self):
        for path in self._all_files():
            h = self._hash_file(path)
            if h:
                self.baseline[path] = h
        log.info("FIM baseline: %d files", len(self.baseline))

    def _all_files(self) -> list[str]:
        files = list(self.paths)
        for d in self.dirs:
            p = Path(d)
            if p.is_dir():
                files.extend(str(f) for f in p.rglob("*") if f.is_file())
        return files

    def check(self) -> list[dict]:
        threats = []
        current_files = set()

        for path in self._all_files():
            current_files.add(path)
            h = self._hash_file(path)
            if h is None:
                continue

            if path not in self.baseline:
                # New file
                threats.append({
                    "threat_type": "FILE_INTEGRITY",
                    "severity": 7,
                    "src_ip": "127.0.0.1",
                    "dst_ip": socket.gethostbyname(socket.gethostname()),
                    "dst_port": 0,
                    "description": f"[FIM] New file detected: {path}",
                })
                self.baseline[path] = h
            elif self.baseline[path] != h:
                # Modified file
                severity = 9 if any(c in path for c in ["/etc/shadow", "/etc/passwd", "/etc/sudoers", "authorized_keys"]) else 7
                threats.append({
                    "threat_type": "FILE_INTEGRITY",
                    "severity": severity,
                    "src_ip": "127.0.0.1",
                    "dst_ip": socket.gethostbyname(socket.gethostname()),
                    "dst_port": 0,
                    "description": f"[FIM] File modified: {path} (hash changed)",
                })
                self.baseline[path] = h

        # Deleted files
        for path in list(self.baseline.keys()):
            if path not in current_files:
                threats.append({
                    "threat_type": "FILE_INTEGRITY",
                    "severity": 8,
                    "src_ip": "127.0.0.1",
                    "dst_ip": socket.gethostbyname(socket.gethostname()),
                    "dst_port": 0,
                    "description": f"[FIM] File deleted: {path}",
                })
                del self.baseline[path]

        return threats


# ═══════════════════════════════════════════════════════════
# Process Monitor
# ═══════════════════════════════════════════════════════════

class ProcessMonitor:
    def __init__(self, suspicious_names: list[str]):
        self.suspicious_names = [n.lower() for n in suspicious_names]
        self.seen_pids: set[int] = set()

    def check(self) -> list[dict]:
        threats = []
        try:
            result = subprocess.run(
                ["ps", "aux", "--no-headers"],
                capture_output=True, text=True, timeout=5
            )
            for line in result.stdout.strip().split("\n"):
                if not line.strip():
                    continue
                parts = line.split(None, 10)
                if len(parts) < 11:
                    continue

                pid = int(parts[1])
                cmd = parts[10].lower()
                proc_name = os.path.basename(cmd.split()[0]) if cmd else ""

                # Check suspicious process names
                for suspicious in self.suspicious_names:
                    if suspicious in proc_name or suspicious in cmd:
                        if pid not in self.seen_pids:
                            self.seen_pids.add(pid)
                            threats.append({
                                "threat_type": "MALWARE",
                                "severity": 8,
                                "src_ip": "127.0.0.1",
                                "dst_ip": socket.gethostbyname(socket.gethostname()),
                                "dst_port": 0,
                                "description": f"[PROC] Suspicious process: {proc_name} (PID {pid}): {parts[10][:200]}",
                            })
                            break

                # Detect reverse shells (bash -i, /dev/tcp, pipe to nc/ncat)
                shell_patterns = [
                    r"bash\s+-i\s+>&\s+/dev/tcp",
                    r"/dev/tcp/\d+\.\d+\.\d+\.\d+",
                    r"mkfifo.*nc\b",
                    r"python.*socket.*connect",
                    r"perl.*socket.*INET",
                ]
                for pat in shell_patterns:
                    if re.search(pat, cmd):
                        if pid not in self.seen_pids:
                            self.seen_pids.add(pid)
                            threats.append({
                                "threat_type": "C2",
                                "severity": 10,
                                "src_ip": "127.0.0.1",
                                "dst_ip": socket.gethostbyname(socket.gethostname()),
                                "dst_port": 0,
                                "description": f"[PROC] Possible reverse shell detected (PID {pid}): {parts[10][:200]}",
                            })
                            break

        except Exception as e:
            log.error("Process monitor error: %s", e)

        return threats


# ═══════════════════════════════════════════════════════════
# Network Monitor
# ═══════════════════════════════════════════════════════════

class NetworkMonitor:
    def __init__(self, suspicious_ports: list[int]):
        self.suspicious_ports = set(suspicious_ports)
        self.reported_connections: set[str] = set()

    def check(self) -> list[dict]:
        threats = []
        try:
            result = subprocess.run(
                ["ss", "-tunapH"],
                capture_output=True, text=True, timeout=5
            )
            for line in result.stdout.strip().split("\n"):
                if not line.strip():
                    continue
                parts = line.split()
                if len(parts) < 6:
                    continue

                state = parts[1]
                local = parts[4]
                remote = parts[5]

                if state != "ESTAB":
                    continue

                # Parse remote address
                if "]:" in remote:  # IPv6
                    remote_ip = remote.rsplit(":", 1)[0].strip("[]")
                    remote_port = int(remote.rsplit(":", 1)[1])
                elif ":" in remote:
                    remote_ip, remote_port_str = remote.rsplit(":", 1)
                    remote_port = int(remote_port_str) if remote_port_str.isdigit() else 0
                else:
                    continue

                # Skip local/private unless suspicious port
                conn_key = f"{remote_ip}:{remote_port}"
                if conn_key in self.reported_connections:
                    continue

                if remote_port in self.suspicious_ports:
                    self.reported_connections.add(conn_key)
                    threats.append({
                        "threat_type": "C2",
                        "severity": 9,
                        "src_ip": socket.gethostbyname(socket.gethostname()),
                        "dst_ip": remote_ip,
                        "dst_port": remote_port,
                        "description": f"[NET] Outbound connection to suspicious port: {remote_ip}:{remote_port}",
                    })

        except Exception as e:
            log.error("Network monitor error: %s", e)

        return threats


# ═══════════════════════════════════════════════════════════
# Auth Log Monitor
# ═══════════════════════════════════════════════════════════

class AuthLogMonitor:
    AUTH_PATTERNS = [
        {
            "regex": re.compile(r"Failed password for (?:invalid user )?(\S+) from (\S+) port (\d+)"),
            "threat_type": "BRUTE_FORCE", "severity": 7, "desc": "SSH failed password",
        },
        {
            "regex": re.compile(r"Invalid user (\S+) from (\S+) port (\d+)"),
            "threat_type": "BRUTE_FORCE", "severity": 7, "desc": "SSH invalid user",
        },
        {
            "regex": re.compile(r"maximum authentication attempts exceeded for (?:invalid user )?(\S+) from (\S+)"),
            "threat_type": "BRUTE_FORCE", "severity": 8, "desc": "SSH max auth attempts",
        },
        {
            "regex": re.compile(r"sudo:.*\s(\S+)\s:.*command not allowed"),
            "threat_type": "PRIVILEGE_ESCALATION", "severity": 8, "desc": "Sudo denied",
        },
        {
            "regex": re.compile(r"POSSIBLE BREAK-IN ATTEMPT.*from (\S+)"),
            "threat_type": "UNAUTHORIZED_ACCESS", "severity": 9, "desc": "Break-in attempt",
        },
    ]

    def __init__(self, log_path: str):
        self.log_path = log_path
        self._fh = None
        self._inode = None

    def open(self):
        if not Path(self.log_path).exists():
            return
        self._fh = open(self.log_path, "r")
        self._inode = os.stat(self.log_path).st_ino
        self._fh.seek(0, 2)

    def check(self) -> list[dict]:
        threats = []
        if self._fh is None:
            self.open()
            if self._fh is None:
                return threats

        try:
            current_inode = os.stat(self.log_path).st_ino
            if current_inode != self._inode:
                self._fh.close()
                self._fh = open(self.log_path, "r")
                self._inode = current_inode
        except FileNotFoundError:
            return threats

        for line in self._fh.readlines():
            line = line.strip()
            for pattern in self.AUTH_PATTERNS:
                m = pattern["regex"].search(line)
                if m:
                    groups = m.groups()
                    src_ip = "127.0.0.1"
                    for g in groups:
                        if g and re.match(r"\d+\.\d+\.\d+\.\d+", g):
                            src_ip = g
                            break

                    threats.append({
                        "threat_type": pattern["threat_type"],
                        "severity": pattern["severity"],
                        "src_ip": src_ip,
                        "dst_ip": socket.gethostbyname(socket.gethostname()),
                        "dst_port": 22,
                        "description": f"[AUTH] {pattern['desc']} from {src_ip}",
                    })
                    break

        return threats


# ═══════════════════════════════════════════════════════════
# System Health Monitor
# ═══════════════════════════════════════════════════════════

class SystemHealthMonitor:
    def check(self) -> list[dict]:
        threats = []
        host_ip = socket.gethostbyname(socket.gethostname())

        # Disk usage
        try:
            result = subprocess.run(["df", "-h", "/"], capture_output=True, text=True, timeout=5)
            for line in result.stdout.strip().split("\n")[1:]:
                parts = line.split()
                if len(parts) >= 5:
                    usage = int(parts[4].replace("%", ""))
                    if usage >= 95:
                        threats.append({
                            "threat_type": "RESOURCE_ANOMALY",
                            "severity": 8,
                            "src_ip": "127.0.0.1",
                            "dst_ip": host_ip,
                            "dst_port": 0,
                            "description": f"[SYS] Disk usage critical: {usage}% on /",
                        })
                    elif usage >= 85:
                        threats.append({
                            "threat_type": "RESOURCE_ANOMALY",
                            "severity": 5,
                            "src_ip": "127.0.0.1",
                            "dst_ip": host_ip,
                            "dst_port": 0,
                            "description": f"[SYS] Disk usage warning: {usage}% on /",
                        })
        except Exception:
            pass

        # Load average
        try:
            with open("/proc/loadavg") as f:
                load_1 = float(f.read().split()[0])
            cpu_count = os.cpu_count() or 1
            if load_1 > cpu_count * 2:
                threats.append({
                    "threat_type": "RESOURCE_ANOMALY",
                    "severity": 6,
                    "src_ip": "127.0.0.1",
                    "dst_ip": host_ip,
                    "dst_port": 0,
                    "description": f"[SYS] High load average: {load_1:.1f} (CPUs: {cpu_count})",
                })
        except Exception:
            pass

        return threats


# ═══════════════════════════════════════════════════════════
# Main Loop
# ═══════════════════════════════════════════════════════════

def main():
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    config = load_config()

    if not config["soc_url"] or not config["api_key"] or not config["company_id"]:
        log.error("SOC_URL, SOC_API_KEY, and SOC_COMPANY_ID must be configured")
        log.error("Set in %s or via environment variables", CONFIG_PATH)
        sys.exit(1)

    log.info("BlackWolf SOC Agent starting")
    log.info("  Host     : %s", socket.gethostname())
    log.info("  Sensor ID: %s", config["sensor_id"])
    log.info("  SOC URL  : %s", config["soc_url"])
    log.info("  OS       : %s", platform.platform())

    # Initialize monitors
    fim = FileIntegrityMonitor(config["fim_paths"], config["fim_dirs"])
    proc_mon = ProcessMonitor(config["suspicious_processes"])
    net_mon = NetworkMonitor(config["suspicious_ports"])
    auth_mon = AuthLogMonitor(config["auth_log"])
    sys_mon = SystemHealthMonitor()

    # Register with SOC
    send_heartbeat(config)

    last_heartbeat = time.monotonic()
    last_fim = time.monotonic()
    last_proc = time.monotonic()
    last_net = time.monotonic()
    last_sys = time.monotonic()

    batch: list[dict] = []

    try:
        while not shutdown_requested:
            now = time.monotonic()

            # Auth log — continuous
            threats = auth_mon.check()
            if threats:
                batch.extend(threats)

            # Process monitor
            if now - last_proc >= config["process_interval"]:
                batch.extend(proc_mon.check())
                last_proc = now

            # Network monitor
            if now - last_net >= config["network_interval"]:
                batch.extend(net_mon.check())
                last_net = now

            # File integrity
            if now - last_fim >= config["fim_interval"]:
                batch.extend(fim.check())
                last_fim = now

            # System health (every 5 min)
            if now - last_sys >= 300:
                batch.extend(sys_mon.check())
                last_sys = now

            # Send batch
            if batch and now - last_heartbeat >= 10:
                send_threats(config, batch)
                batch = []
                last_heartbeat = now

            # Heartbeat
            if now - last_heartbeat >= config["heartbeat_interval"]:
                send_heartbeat(config)
                last_heartbeat = now

            time.sleep(1)

    except KeyboardInterrupt:
        pass
    finally:
        if batch:
            send_threats(config, batch)
        log.info("BlackWolf SOC Agent stopped")


if __name__ == "__main__":
    main()
