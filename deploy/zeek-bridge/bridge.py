#!/usr/bin/env python3
"""
Zeek Bridge - Reads Zeek conn.log and dns.log, detects anomalies,
and sends network flow data + threats to BlackWolf SOC backend.
"""

import json
import os
import time
import logging
import requests
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger("zeek-bridge")

SOC_API_URL = os.getenv("SOC_API_URL", "http://backend:8080")
SOC_API_KEY = os.getenv("SOC_API_KEY", "")
SOC_COMPANY_ID = os.getenv("SOC_COMPANY_ID", "")
ZEEK_LOG_DIR = os.getenv("ZEEK_LOG_DIR", "/opt/zeek/logs/current")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "10"))

# Detection thresholds
DNS_TUNNEL_QUERY_LEN = 50  # DNS query > 50 chars = suspicious
DNS_TUNNEL_FREQ = 100  # > 100 DNS queries to same domain in 5 min
C2_BEACON_TOLERANCE = 0.15  # interval std_dev/mean < 15% = beacon
DATA_EXFIL_BYTES = 50_000_000  # > 50MB outbound to single IP
LATERAL_PORTS = {22, 135, 139, 445, 3389, 5985, 5986}  # SSH, RPC, SMB, RDP, WinRM
PRIVATE_PREFIXES = ("10.", "172.16.", "172.17.", "172.18.", "172.19.",
                    "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
                    "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
                    "172.30.", "172.31.", "192.168.")


def is_private(ip):
    return any(ip.startswith(p) for p in PRIVATE_PREFIXES) if ip else False


class ZeekBridge:
    def __init__(self):
        self.conn_pos = 0
        self.dns_pos = 0
        self.conn_inode = 0
        self.dns_inode = 0
        # Buffers for detection
        self.dns_queries = defaultdict(list)  # domain -> [timestamps]
        self.outbound_bytes = defaultdict(int)  # dst_ip -> total bytes
        self.connection_times = defaultdict(list)  # dst_ip -> [timestamps]
        self.last_cleanup = time.time()

    def tail_file(self, filepath, pos, inode):
        """Tail a Zeek log file, handling rotation."""
        try:
            stat = os.stat(filepath)
            current_inode = stat.st_ino
            if current_inode != inode:
                pos = 0
                inode = current_inode

            with open(filepath, 'r') as f:
                f.seek(pos)
                lines = []
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        lines.append(line)
                new_pos = f.tell()
            return lines, new_pos, inode
        except FileNotFoundError:
            return [], pos, inode

    def parse_conn_log(self, line):
        """Parse Zeek conn.log TSV format."""
        try:
            fields = line.split('\t')
            if len(fields) < 15:
                return None
            return {
                "ts": float(fields[0]),
                "uid": fields[1],
                "src_ip": fields[2],
                "src_port": int(fields[3]) if fields[3] != '-' else 0,
                "dst_ip": fields[4],
                "dst_port": int(fields[5]) if fields[5] != '-' else 0,
                "proto": fields[6],
                "duration": float(fields[8]) if fields[8] != '-' else 0,
                "orig_bytes": int(fields[9]) if fields[9] != '-' else 0,
                "resp_bytes": int(fields[10]) if fields[10] != '-' else 0,
                "orig_pkts": int(fields[12]) if fields[12] != '-' else 0,
                "resp_pkts": int(fields[13]) if fields[13] != '-' else 0,
            }
        except (ValueError, IndexError):
            return None

    def parse_dns_log(self, line):
        """Parse Zeek dns.log TSV format."""
        try:
            fields = line.split('\t')
            if len(fields) < 10:
                return None
            return {
                "ts": float(fields[0]),
                "src_ip": fields[2],
                "dst_ip": fields[4],
                "query": fields[9] if len(fields) > 9 else "",
                "qtype": fields[11] if len(fields) > 11 else "",
            }
        except (ValueError, IndexError):
            return None

    def detect_dns_tunneling(self, dns_entry):
        """Detect DNS tunneling by query length and frequency."""
        threats = []
        query = dns_entry.get("query", "")
        src_ip = dns_entry.get("src_ip", "")

        # Long query names (potential data exfil via DNS)
        if len(query) > DNS_TUNNEL_QUERY_LEN:
            domain = '.'.join(query.split('.')[-2:])
            threats.append({
                "threat_type": "DNS Tunneling Suspected",
                "severity": 8,
                "src_ip": src_ip,
                "dst_ip": dns_entry.get("dst_ip", ""),
                "dst_port": 53,
                "description": f"Unusually long DNS query ({len(query)} chars) to {domain}: {query[:80]}..."
            })

        # High frequency to same domain
        domain = '.'.join(query.split('.')[-2:]) if query else ""
        if domain:
            now = time.time()
            self.dns_queries[domain].append(now)
            # Clean old entries
            self.dns_queries[domain] = [t for t in self.dns_queries[domain] if now - t < 300]
            if len(self.dns_queries[domain]) > DNS_TUNNEL_FREQ:
                threats.append({
                    "threat_type": "DNS Tunnel Frequency Anomaly",
                    "severity": 9,
                    "src_ip": src_ip,
                    "dst_ip": dns_entry.get("dst_ip", ""),
                    "dst_port": 53,
                    "description": f"High DNS query frequency to {domain}: {len(self.dns_queries[domain])} queries in 5 min"
                })
        return threats

    def detect_c2_beaconing(self, conn_entry):
        """Detect C2 beaconing by regular connection intervals."""
        threats = []
        dst_ip = conn_entry["dst_ip"]
        if is_private(dst_ip):
            return threats

        now = conn_entry["ts"]
        self.connection_times[dst_ip].append(now)
        times = self.connection_times[dst_ip]
        # Keep last 1 hour
        times = [t for t in times if now - t < 3600]
        self.connection_times[dst_ip] = times

        if len(times) >= 10:
            intervals = [times[i+1] - times[i] for i in range(len(times)-1)]
            if intervals:
                mean_interval = sum(intervals) / len(intervals)
                if mean_interval > 0:
                    variance = sum((x - mean_interval)**2 for x in intervals) / len(intervals)
                    std_dev = variance ** 0.5
                    coefficient_of_variation = std_dev / mean_interval
                    if coefficient_of_variation < C2_BEACON_TOLERANCE:
                        threats.append({
                            "threat_type": "C2 Beacon Detected",
                            "severity": 9,
                            "src_ip": conn_entry["src_ip"],
                            "dst_ip": dst_ip,
                            "dst_port": conn_entry["dst_port"],
                            "description": f"Regular beaconing to {dst_ip}:{conn_entry['dst_port']} "
                                         f"every ~{mean_interval:.0f}s (CV={coefficient_of_variation:.3f}, "
                                         f"{len(times)} connections in 1h)"
                        })
        return threats

    def detect_data_exfil(self, conn_entry):
        """Detect large data exfiltration."""
        threats = []
        dst_ip = conn_entry["dst_ip"]
        if is_private(dst_ip):
            return threats

        self.outbound_bytes[dst_ip] += conn_entry["orig_bytes"]
        if self.outbound_bytes[dst_ip] > DATA_EXFIL_BYTES:
            mb = self.outbound_bytes[dst_ip] / (1024*1024)
            threats.append({
                "threat_type": "Data Exfiltration Suspected",
                "severity": 8,
                "src_ip": conn_entry["src_ip"],
                "dst_ip": dst_ip,
                "dst_port": conn_entry["dst_port"],
                "description": f"Large outbound data transfer to {dst_ip}: {mb:.1f} MB"
            })
            self.outbound_bytes[dst_ip] = 0  # Reset after alerting
        return threats

    def detect_lateral_movement(self, conn_entry):
        """Detect lateral movement (internal-to-internal on admin ports)."""
        threats = []
        if (is_private(conn_entry["src_ip"]) and
            is_private(conn_entry["dst_ip"]) and
            conn_entry["dst_port"] in LATERAL_PORTS):
            threats.append({
                "threat_type": "Lateral Movement Suspected",
                "severity": 7,
                "src_ip": conn_entry["src_ip"],
                "dst_ip": conn_entry["dst_ip"],
                "dst_port": conn_entry["dst_port"],
                "description": f"Internal connection {conn_entry['src_ip']} -> "
                             f"{conn_entry['dst_ip']}:{conn_entry['dst_port']} "
                             f"({conn_entry['proto']}) - possible lateral movement"
            })
        return threats

    def send_threats(self, threats):
        """Send detected threats to SOC backend."""
        if not threats or not SOC_API_KEY:
            return
        try:
            payload = {
                "sensor_id": "zeek-ndr",
                "company_id": SOC_COMPANY_ID,
                "api_key": SOC_API_KEY,
                "threats": threats,
                "packets": []
            }
            requests.post(f"{SOC_API_URL}/api/v1/sensors/upload",
                        json=payload, timeout=10)
        except Exception as e:
            log.error(f"Failed to send threats: {e}")

    def cleanup_buffers(self):
        """Periodic cleanup of detection buffers."""
        now = time.time()
        if now - self.last_cleanup < 300:
            return
        self.last_cleanup = now
        cutoff = now - 3600
        for k in list(self.dns_queries.keys()):
            self.dns_queries[k] = [t for t in self.dns_queries[k] if t > cutoff]
            if not self.dns_queries[k]:
                del self.dns_queries[k]
        for k in list(self.connection_times.keys()):
            self.connection_times[k] = [t for t in self.connection_times[k] if t > cutoff]
            if not self.connection_times[k]:
                del self.connection_times[k]

    def run(self):
        """Main loop."""
        log.info(f"Zeek Bridge started. Monitoring: {ZEEK_LOG_DIR}")
        conn_log = os.path.join(ZEEK_LOG_DIR, "conn.log")
        dns_log = os.path.join(ZEEK_LOG_DIR, "dns.log")

        while True:
            threats = []

            # Process conn.log
            lines, self.conn_pos, self.conn_inode = self.tail_file(
                conn_log, self.conn_pos, self.conn_inode)
            for line in lines:
                entry = self.parse_conn_log(line)
                if not entry:
                    continue
                threats.extend(self.detect_c2_beaconing(entry))
                threats.extend(self.detect_data_exfil(entry))
                threats.extend(self.detect_lateral_movement(entry))

            # Process dns.log
            lines, self.dns_pos, self.dns_inode = self.tail_file(
                dns_log, self.dns_pos, self.dns_inode)
            for line in lines:
                entry = self.parse_dns_log(line)
                if not entry:
                    continue
                threats.extend(self.detect_dns_tunneling(entry))

            if threats:
                log.info(f"Detected {len(threats)} network threats")
                self.send_threats(threats)

            self.cleanup_buffers()
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    bridge = ZeekBridge()
    bridge.run()
