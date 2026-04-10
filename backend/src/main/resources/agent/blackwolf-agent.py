#!/usr/bin/env python3
"""
BlackWolf SOC Agent — Lightweight EDR
======================================

Cross-platform security agent that monitors a host and reports to
the BlackWolf SOC platform. Supports Linux, Windows, and macOS.

Capabilities:
  - File Integrity Monitoring (FIM): detects changes in critical paths
  - Auth log monitoring: brute force, privilege escalation
  - Process monitoring: suspicious processes, reverse shells
  - Network connection monitoring: C2 beacons, unusual outbound
  - System resource anomalies: disk full, high CPU/memory

Install:
  Linux : sudo ./install.sh
  macOS : sudo ./install-mac.sh
  Windows: Run install.ps1 as Administrator
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
# Platform Detection
# ═══════════════════════════════════════════════════════════

PLATFORM = platform.system().lower()  # 'linux', 'darwin', 'windows'
IS_LINUX = PLATFORM == "linux"
IS_MAC = PLATFORM == "darwin"
IS_WINDOWS = PLATFORM == "windows"

# ═══════════════════════════════════════════════════════════
# Platform-specific defaults
# ═══════════════════════════════════════════════════════════

def _default_config_path() -> str:
    if IS_WINDOWS:
        return os.path.join(os.getenv("PROGRAMDATA", r"C:\ProgramData"), "BlackWolfAgent", "agent.conf")
    elif IS_MAC:
        return "/etc/blackwolf-agent/agent.conf"
    else:
        return "/etc/blackwolf-agent/agent.conf"


def _default_fim_paths() -> list[str]:
    if IS_WINDOWS:
        sys_root = os.getenv("SYSTEMROOT", r"C:\Windows")
        return [
            os.path.join(sys_root, "System32", "drivers", "etc", "hosts"),
            os.path.join(sys_root, "System32", "config", "SAM"),
            os.path.join(sys_root, "System32", "config", "SYSTEM"),
            os.path.join(sys_root, "System32", "config", "SECURITY"),
        ]
    elif IS_MAC:
        return [
            "/etc/hosts", "/etc/resolv.conf", "/etc/pam.d/sudo",
            "/etc/ssh/sshd_config", "/etc/shells",
            os.path.expanduser("~/.ssh/authorized_keys"),
            os.path.expanduser("~/.zshrc"),
            os.path.expanduser("~/.bash_profile"),
        ]
    else:
        return [
            "/etc/passwd", "/etc/shadow", "/etc/sudoers", "/etc/ssh/sshd_config",
            "/etc/crontab", "/etc/hosts", "/etc/resolv.conf",
            "/root/.ssh/authorized_keys", "/root/.bashrc",
        ]


def _default_fim_dirs() -> list[str]:
    if IS_WINDOWS:
        return [
            os.path.join(os.getenv("SYSTEMROOT", r"C:\Windows"), "System32", "Tasks"),
        ]
    elif IS_MAC:
        return [
            "/etc/cron.d", "/Library/LaunchDaemons", "/Library/LaunchAgents",
        ]
    else:
        return [
            "/etc/cron.d", "/etc/cron.daily", "/etc/sudoers.d",
        ]


def _default_auth_log() -> str:
    if IS_MAC:
        return "/var/log/system.log"
    else:
        return "/var/log/auth.log"


# ═══════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════

CONFIG_PATH = os.getenv("AGENT_CONFIG", _default_config_path())
DEFAULT_CONFIG = {
    "soc_url": os.getenv("SOC_URL", ""),
    "api_key": os.getenv("SOC_API_KEY", ""),
    "company_id": os.getenv("SOC_COMPANY_ID", ""),
    "sensor_id": os.getenv("SOC_SENSOR_ID", f"agent-{socket.gethostname()}"),
    "heartbeat_interval": 60,
    "fim_interval": 300,
    "process_interval": 30,
    "network_interval": 60,
    "auth_log": _default_auth_log(),
    "fim_paths": _default_fim_paths(),
    "fim_dirs": _default_fim_dirs(),
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
            # Process blocking commands from backend response
            try:
                data = resp.json()
                commands = data.get("commands", [])
                if commands:
                    apply_block_commands(commands)
            except (ValueError, KeyError):
                pass
            return True
        log.warning("SOC returned %d: %s", resp.status_code, resp.text[:300])
        return False
    except requests.RequestException as e:
        log.error("Failed to send to SOC: %s", e)
        return False


# Set of already-applied blocks to avoid duplicate iptables calls
_applied_blocks: set[str] = set()


def apply_block_commands(commands: list[dict]) -> None:
    """Apply block_ip and block_subnet commands via the host firewall."""
    for cmd in commands:
        cmd_type = cmd.get("type", "")
        target = cmd.get("ip", "")
        reason = cmd.get("reason", "")

        if not target or cmd_type not in ("block_ip", "block_subnet"):
            continue

        cache_key = f"{cmd_type}:{target}"
        if cache_key in _applied_blocks:
            continue

        if IS_LINUX:
            _apply_linux_block(target, reason)
        elif IS_MAC:
            _apply_mac_block(target, reason)
        # Windows: netsh advfirewall not implemented yet

        _applied_blocks.add(cache_key)


def _apply_linux_block(target: str, reason: str) -> None:
    """Block an IP or CIDR on Linux using iptables/ip6tables."""
    is_ipv6 = ":" in target
    fw_cmd = "ip6tables" if is_ipv6 else "iptables"

    # Check if rule already exists
    check = subprocess.run(
        [fw_cmd, "-C", "INPUT", "-s", target, "-j", "DROP"],
        capture_output=True, timeout=10,
    )
    if check.returncode == 0:
        log.debug("Firewall rule already exists for %s", target)
        return

    # Add DROP rule
    result = subprocess.run(
        [fw_cmd, "-I", "INPUT", "1", "-s", target, "-j", "DROP"],
        capture_output=True, timeout=10,
    )
    if result.returncode == 0:
        log.warning("FIREWALL BLOCKED %s — %s", target, reason)
    else:
        log.error("Failed to block %s: %s", target, result.stderr.decode(errors="replace"))


def _apply_mac_block(target: str, reason: str) -> None:
    """Block an IP or CIDR on macOS using pfctl."""
    # Add to persistent blocklist file
    blocklist_path = Path("/etc/pf.blackwolf.blocked")
    try:
        existing = blocklist_path.read_text() if blocklist_path.exists() else ""
        if target not in existing:
            with open(blocklist_path, "a") as f:
                f.write(f"{target}  # {reason}\n")
            # Reload pf table
            subprocess.run(
                ["pfctl", "-t", "blackwolf_blocked", "-T", "add", target],
                capture_output=True, timeout=10,
            )
            log.warning("FIREWALL BLOCKED %s — %s", target, reason)
    except OSError as e:
        log.error("Failed to block %s on macOS: %s", target, e)


def send_heartbeat(config: dict) -> bool:
    return send_threats(config, [])


# ═══════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════

def _get_host_ip() -> str:
    try:
        return socket.gethostbyname(socket.gethostname())
    except socket.gaierror:
        return "127.0.0.1"


def _run_cmd(cmd: list[str], timeout: int = 5) -> str | None:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.stdout
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════
# File Integrity Monitoring (FIM) — Cross-platform
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
        host_ip = _get_host_ip()

        for path in self._all_files():
            current_files.add(path)
            h = self._hash_file(path)
            if h is None:
                continue

            if path not in self.baseline:
                threats.append({
                    "threat_type": "FILE_INTEGRITY",
                    "severity": 7,
                    "src_ip": "127.0.0.1",
                    "dst_ip": host_ip,
                    "dst_port": 0,
                    "description": f"[FIM] New file detected: {path}",
                })
                self.baseline[path] = h
            elif self.baseline[path] != h:
                critical_names = ["shadow", "passwd", "sudoers", "authorized_keys", "SAM", "SYSTEM", "SECURITY"]
                severity = 9 if any(c in path for c in critical_names) else 7
                threats.append({
                    "threat_type": "FILE_INTEGRITY",
                    "severity": severity,
                    "src_ip": "127.0.0.1",
                    "dst_ip": host_ip,
                    "dst_port": 0,
                    "description": f"[FIM] File modified: {path} (hash changed)",
                })
                self.baseline[path] = h

        for path in list(self.baseline.keys()):
            if path not in current_files:
                threats.append({
                    "threat_type": "FILE_INTEGRITY",
                    "severity": 8,
                    "src_ip": "127.0.0.1",
                    "dst_ip": host_ip,
                    "dst_port": 0,
                    "description": f"[FIM] File deleted: {path}",
                })
                del self.baseline[path]

        return threats


# ═══════════════════════════════════════════════════════════
# Process Monitor — Cross-platform
# ═══════════════════════════════════════════════════════════

class ProcessMonitor:
    def __init__(self, suspicious_names: list[str]):
        self.suspicious_names = [n.lower() for n in suspicious_names]
        self.seen_pids: set[int] = set()

    def _get_processes_linux(self) -> list[tuple[int, str]]:
        output = _run_cmd(["ps", "aux", "--no-headers"])
        if not output:
            return []
        procs = []
        for line in output.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split(None, 10)
            if len(parts) >= 11:
                try:
                    procs.append((int(parts[1]), parts[10]))
                except ValueError:
                    pass
        return procs

    def _get_processes_mac(self) -> list[tuple[int, str]]:
        output = _run_cmd(["ps", "aux"])
        if not output:
            return []
        procs = []
        for line in output.strip().split("\n")[1:]:  # skip header
            if not line.strip():
                continue
            parts = line.split(None, 10)
            if len(parts) >= 11:
                try:
                    procs.append((int(parts[1]), parts[10]))
                except ValueError:
                    pass
        return procs

    def _get_processes_windows(self) -> list[tuple[int, str]]:
        output = _run_cmd(["tasklist", "/FO", "CSV", "/NH"])
        if not output:
            return []
        procs = []
        for line in output.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            # CSV format: "name.exe","PID","Session","Session#","Mem Usage"
            parts = line.split('","')
            if len(parts) >= 2:
                name = parts[0].strip('"')
                try:
                    pid = int(parts[1].strip('"'))
                    procs.append((pid, name))
                except ValueError:
                    pass
        return procs

    def check(self) -> list[dict]:
        threats = []
        host_ip = _get_host_ip()

        if IS_WINDOWS:
            processes = self._get_processes_windows()
        elif IS_MAC:
            processes = self._get_processes_mac()
        else:
            processes = self._get_processes_linux()

        for pid, cmd in processes:
            cmd_lower = cmd.lower()
            proc_name = os.path.basename(cmd_lower.split()[0]) if cmd_lower else ""

            for suspicious in self.suspicious_names:
                if suspicious in proc_name or suspicious in cmd_lower:
                    if pid not in self.seen_pids:
                        self.seen_pids.add(pid)
                        threats.append({
                            "threat_type": "MALWARE",
                            "severity": 8,
                            "src_ip": "127.0.0.1",
                            "dst_ip": host_ip,
                            "dst_port": 0,
                            "description": f"[PROC] Suspicious process: {proc_name} (PID {pid}): {cmd[:200]}",
                        })
                        break

            # Detect reverse shells (Linux/macOS only — more relevant)
            if not IS_WINDOWS:
                shell_patterns = [
                    r"bash\s+-i\s+>&\s+/dev/tcp",
                    r"/dev/tcp/\d+\.\d+\.\d+\.\d+",
                    r"mkfifo.*nc\b",
                    r"python.*socket.*connect",
                    r"perl.*socket.*INET",
                ]
                for pat in shell_patterns:
                    if re.search(pat, cmd_lower):
                        if pid not in self.seen_pids:
                            self.seen_pids.add(pid)
                            threats.append({
                                "threat_type": "C2",
                                "severity": 10,
                                "src_ip": "127.0.0.1",
                                "dst_ip": host_ip,
                                "dst_port": 0,
                                "description": f"[PROC] Possible reverse shell detected (PID {pid}): {cmd[:200]}",
                            })
                            break
            else:
                # Windows: detect powershell reverse shells
                win_shell_patterns = [
                    r"powershell.*-e\s+[A-Za-z0-9+/=]{20,}",
                    r"powershell.*downloadstring",
                    r"powershell.*invoke-expression",
                    r"powershell.*new-object\s+system\.net\.sockets",
                    r"powershell.*hidden.*-nop",
                    r"certutil.*-urlcache",
                    r"bitsadmin.*\/transfer",
                    r"mshta\s+http",
                ]
                for pat in win_shell_patterns:
                    if re.search(pat, cmd_lower):
                        if pid not in self.seen_pids:
                            self.seen_pids.add(pid)
                            threats.append({
                                "threat_type": "C2",
                                "severity": 10,
                                "src_ip": "127.0.0.1",
                                "dst_ip": host_ip,
                                "dst_port": 0,
                                "description": f"[PROC] Possible reverse shell/downloader detected (PID {pid}): {cmd[:200]}",
                            })
                            break

        return threats


# ═══════════════════════════════════════════════════════════
# Network Monitor — Cross-platform
# ═══════════════════════════════════════════════════════════

class NetworkMonitor:
    def __init__(self, suspicious_ports: list[int]):
        self.suspicious_ports = set(suspicious_ports)
        self.reported_connections: set[str] = set()

    def _parse_netstat_line(self, line: str) -> tuple[str, int] | None:
        """Parse a netstat output line to extract remote IP:port for ESTABLISHED connections."""
        parts = line.split()
        if len(parts) < 4:
            return None

        # Look for ESTABLISHED state
        if not any(p.upper() in ("ESTABLISHED", "ESTAB") for p in parts):
            return None

        # Find the foreign/remote address column (usually index 2 or 4)
        for part in parts:
            if "." in part or "]:" in part:
                # Try to parse as ip:port
                if "]:" in part:  # IPv6 [::1]:port
                    remote_ip = part.rsplit(":", 1)[0].strip("[]")
                    port_str = part.rsplit(":", 1)[1]
                elif part.count(":") == 1:  # IPv4 ip:port
                    remote_ip, port_str = part.rsplit(":", 1)
                elif part.count(".") >= 4:  # netstat format like 10.0.0.1.443
                    remote_ip = ".".join(part.split(".")[:-1])
                    port_str = part.split(".")[-1]
                else:
                    continue

                try:
                    port = int(port_str)
                    if port in self.suspicious_ports:
                        return (remote_ip, port)
                except ValueError:
                    continue
        return None

    def _check_linux(self) -> list[dict]:
        threats = []
        host_ip = _get_host_ip()
        output = _run_cmd(["ss", "-tunapH"])
        if not output:
            return threats

        for line in output.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split()
            if len(parts) < 6:
                continue

            state = parts[1]
            remote = parts[5]

            if state != "ESTAB":
                continue

            if "]:" in remote:
                remote_ip = remote.rsplit(":", 1)[0].strip("[]")
                remote_port = int(remote.rsplit(":", 1)[1])
            elif ":" in remote:
                remote_ip, remote_port_str = remote.rsplit(":", 1)
                remote_port = int(remote_port_str) if remote_port_str.isdigit() else 0
            else:
                continue

            conn_key = f"{remote_ip}:{remote_port}"
            if conn_key in self.reported_connections:
                continue

            if remote_port in self.suspicious_ports:
                self.reported_connections.add(conn_key)
                threats.append({
                    "threat_type": "C2",
                    "severity": 9,
                    "src_ip": host_ip,
                    "dst_ip": remote_ip,
                    "dst_port": remote_port,
                    "description": f"[NET] Outbound connection to suspicious port: {remote_ip}:{remote_port}",
                })

        return threats

    def _check_netstat(self) -> list[dict]:
        """Cross-platform check using netstat (macOS, Windows)."""
        threats = []
        host_ip = _get_host_ip()

        if IS_WINDOWS:
            output = _run_cmd(["netstat", "-n", "-p", "TCP"])
        else:
            output = _run_cmd(["netstat", "-an", "-p", "tcp"])

        if not output:
            return threats

        for line in output.strip().split("\n"):
            line = line.strip()
            if not line:
                continue

            result = self._parse_netstat_line(line)
            if result is None:
                continue

            remote_ip, remote_port = result
            conn_key = f"{remote_ip}:{remote_port}"
            if conn_key in self.reported_connections:
                continue

            self.reported_connections.add(conn_key)
            threats.append({
                "threat_type": "C2",
                "severity": 9,
                "src_ip": host_ip,
                "dst_ip": remote_ip,
                "dst_port": remote_port,
                "description": f"[NET] Outbound connection to suspicious port: {remote_ip}:{remote_port}",
            })

        return threats

    def check(self) -> list[dict]:
        if IS_LINUX:
            return self._check_linux()
        return self._check_netstat()


# ═══════════════════════════════════════════════════════════
# Auth Log Monitor — Cross-platform
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
        if IS_WINDOWS:
            return  # Windows uses Event Log via check_windows()
        if not Path(self.log_path).exists():
            return
        self._fh = open(self.log_path, "r")
        self._inode = os.stat(self.log_path).st_ino
        self._fh.seek(0, 2)

    def _check_unix(self) -> list[dict]:
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
                        "dst_ip": _get_host_ip(),
                        "dst_port": 22,
                        "description": f"[AUTH] {pattern['desc']} from {src_ip}",
                    })
                    break

        return threats

    def _check_windows(self) -> list[dict]:
        """Check Windows Security Event Log for failed logons (Event ID 4625)."""
        threats = []
        host_ip = _get_host_ip()

        # Query last 60 seconds of failed logon events
        cmd = [
            "powershell", "-NoProfile", "-Command",
            "Get-WinEvent -FilterHashtable @{LogName='Security';Id=4625} "
            "-MaxEvents 20 -ErrorAction SilentlyContinue | "
            "Select-Object -ExpandProperty Message"
        ]
        output = _run_cmd(cmd, timeout=10)
        if not output:
            return threats

        # Each event message block
        ip_pattern = re.compile(r"Source Network Address:\s+(\S+)")
        user_pattern = re.compile(r"Account Name:\s+(\S+)")

        events = output.split("An account failed to log on")
        for event in events[1:]:  # skip first empty split
            src_ip = "127.0.0.1"
            m = ip_pattern.search(event)
            if m and m.group(1) != "-":
                src_ip = m.group(1)

            threats.append({
                "threat_type": "BRUTE_FORCE",
                "severity": 7,
                "src_ip": src_ip,
                "dst_ip": host_ip,
                "dst_port": 3389,
                "description": f"[AUTH] Windows failed logon from {src_ip}",
            })

        return threats

    def check(self) -> list[dict]:
        if IS_WINDOWS:
            return self._check_windows()
        return self._check_unix()


# ═══════════════════════════════════════════════════════════
# System Health Monitor — Cross-platform
# ═══════════════════════════════════════════════════════════

class SystemHealthMonitor:
    def check(self) -> list[dict]:
        threats = []
        host_ip = _get_host_ip()

        # Disk usage — cross-platform via Python
        try:
            if IS_WINDOWS:
                usage = self._disk_usage_windows()
            else:
                usage = self._disk_usage_unix()

            if usage is not None:
                if usage >= 95:
                    threats.append({
                        "threat_type": "RESOURCE_ANOMALY",
                        "severity": 8,
                        "src_ip": "127.0.0.1",
                        "dst_ip": host_ip,
                        "dst_port": 0,
                        "description": f"[SYS] Disk usage critical: {usage}%",
                    })
                elif usage >= 85:
                    threats.append({
                        "threat_type": "RESOURCE_ANOMALY",
                        "severity": 5,
                        "src_ip": "127.0.0.1",
                        "dst_ip": host_ip,
                        "dst_port": 0,
                        "description": f"[SYS] Disk usage warning: {usage}%",
                    })
        except Exception:
            pass

        # Load average / CPU
        try:
            load = self._get_load()
            if load is not None:
                cpu_count = os.cpu_count() or 1
                if load > cpu_count * 2:
                    threats.append({
                        "threat_type": "RESOURCE_ANOMALY",
                        "severity": 6,
                        "src_ip": "127.0.0.1",
                        "dst_ip": host_ip,
                        "dst_port": 0,
                        "description": f"[SYS] High load/CPU: {load:.1f} (CPUs: {cpu_count})",
                    })
        except Exception:
            pass

        return threats

    def _disk_usage_unix(self) -> int | None:
        output = _run_cmd(["df", "-h", "/"])
        if not output:
            return None
        for line in output.strip().split("\n")[1:]:
            parts = line.split()
            if len(parts) >= 5:
                return int(parts[4].replace("%", ""))
        return None

    def _disk_usage_windows(self) -> int | None:
        output = _run_cmd([
            "powershell", "-NoProfile", "-Command",
            "(Get-PSDrive C).Used / ((Get-PSDrive C).Used + (Get-PSDrive C).Free) * 100"
        ], timeout=10)
        if output and output.strip():
            try:
                return int(float(output.strip()))
            except ValueError:
                pass
        return None

    def _get_load(self) -> float | None:
        if IS_LINUX:
            try:
                with open("/proc/loadavg") as f:
                    return float(f.read().split()[0])
            except Exception:
                return None
        elif IS_MAC:
            output = _run_cmd(["sysctl", "-n", "vm.loadavg"])
            if output:
                # Format: "{ 1.23 4.56 7.89 }"
                parts = output.strip().strip("{}").split()
                if parts:
                    return float(parts[0])
            return None
        elif IS_WINDOWS:
            output = _run_cmd([
                "powershell", "-NoProfile", "-Command",
                "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average"
            ], timeout=10)
            if output and output.strip():
                try:
                    return float(output.strip())
                except ValueError:
                    pass
            return None
        return None


# ═══════════════════════════════════════════════════════════
# Main Loop
# ═══════════════════════════════════════════════════════════

def main():
    signal.signal(signal.SIGINT, handle_signal)
    if not IS_WINDOWS:
        signal.signal(signal.SIGTERM, handle_signal)

    config = load_config()

    if not config["soc_url"] or not config["api_key"] or not config["company_id"]:
        log.error("SOC_URL, SOC_API_KEY, and SOC_COMPANY_ID must be configured")
        log.error("Set in %s or via environment variables", CONFIG_PATH)
        sys.exit(1)

    log.info("BlackWolf SOC Agent starting")
    log.info("  Host     : %s", socket.gethostname())
    log.info("  Sensor ID: %s", config["sensor_id"])
    log.info("  SOC URL  : %s", config["soc_url"])
    log.info("  OS       : %s (%s)", platform.platform(), PLATFORM)

    # Initialize monitors
    fim = FileIntegrityMonitor(config["fim_paths"], config["fim_dirs"])
    proc_mon = ProcessMonitor(config["suspicious_processes"])
    net_mon = NetworkMonitor(config["suspicious_ports"])
    auth_mon = AuthLogMonitor(config["auth_log"])
    sys_mon = SystemHealthMonitor()

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
