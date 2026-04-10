import ssl
import socket
import subprocess
import re
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict

import dns.resolver
import requests as http_requests
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="ASM Scanner Microservice", version="1.0.0")

# ---------- Common subdomain prefixes ----------
SUBDOMAIN_PREFIXES = [
    "www", "mail", "ftp", "admin", "dev", "staging", "api",
    "app", "cdn", "vpn", "test", "portal", "blog", "shop",
    "ns1", "ns2", "mx",
]

# ---------- Default ports ----------
DEFAULT_PORTS = "21,22,25,53,80,110,143,443,993,995,3306,3389,5432,8080,8443"

# ---------- Security headers ----------
SECURITY_HEADERS = [
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Strict-Transport-Security",
    "Content-Security-Policy",
    "X-XSS-Protection",
]

HEADER_RISK: Dict[str, str] = {
    "X-Frame-Options": "Medium – clickjacking risk without this header.",
    "X-Content-Type-Options": "Low – MIME-sniffing risk without this header.",
    "Strict-Transport-Security": "High – protocol downgrade / MITM risk without this header.",
    "Content-Security-Policy": "High – XSS risk without this header.",
    "X-XSS-Protection": "Low – legacy XSS filter; missing on modern browsers.",
}


# ---------- Request models ----------

class SubdomainRequest(BaseModel):
    domain: str


class PortScanRequest(BaseModel):
    target: str
    ports: Optional[str] = DEFAULT_PORTS


class HeaderRequest(BaseModel):
    url: str


class CertRequest(BaseModel):
    domain: str


# ---------- Helper ----------

def _ok(data: Any) -> Dict[str, Any]:
    return {"success": True, "data": data, "error": None}


def _err(message: str) -> Dict[str, Any]:
    return {"success": False, "data": None, "error": message}


# ---------- Endpoints ----------

@app.get("/health")
def health():
    return _ok({"status": "ok", "service": "asm-scanner"})


@app.post("/scan/subdomains")
def scan_subdomains(request: SubdomainRequest):
    domain = request.domain.strip().lower()
    found = []

    resolver = dns.resolver.Resolver()
    resolver.lifetime = 10.0
    resolver.timeout = 10.0

    for prefix in SUBDOMAIN_PREFIXES:
        fqdn = f"{prefix}.{domain}"
        try:
            answers = resolver.resolve(fqdn, "A")
            ips = [rdata.address for rdata in answers]
            found.append({"subdomain": fqdn, "ips": ips})
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.Timeout):
            pass
        except Exception:
            pass

    return _ok({"domain": domain, "subdomains": found, "count": len(found)})


@app.post("/scan/ports")
def scan_ports(request: PortScanRequest):
    target = request.target.strip()
    ports = (request.ports or DEFAULT_PORTS).strip()

    try:
        result = subprocess.run(
            ["nmap", "-Pn", "-sT", "-p", ports, "--open", target],
            capture_output=True,
            text=True,
            timeout=30,
        )
        output = result.stdout
    except subprocess.TimeoutExpired:
        return _err("Port scan timed out after 30 seconds.")
    except FileNotFoundError:
        return _err("nmap is not installed or not in PATH.")
    except Exception as exc:
        return _err(f"Port scan failed: {exc}")

    open_ports = []
    # Parse lines like: "80/tcp   open  http"
    pattern = re.compile(r"^(\d+)/(tcp|udp)\s+open\s+(\S+)", re.MULTILINE)
    for match in pattern.finditer(output):
        open_ports.append({
            "port": int(match.group(1)),
            "protocol": match.group(2),
            "state": "open",
            "service": match.group(3),
        })

    return _ok({"target": target, "ports_scanned": ports, "open_ports": open_ports, "count": len(open_ports)})


@app.post("/scan/headers")
def scan_headers(request: HeaderRequest):
    url = request.url.strip()

    try:
        resp = http_requests.get(url, timeout=10, allow_redirects=True, verify=False)
        headers = resp.headers
    except http_requests.exceptions.Timeout:
        return _err("HTTP request timed out after 10 seconds.")
    except Exception as exc:
        return _err(f"HTTP request failed: {exc}")

    present = []
    missing = []

    for header in SECURITY_HEADERS:
        value = headers.get(header)
        if value is not None:
            present.append({"header": header, "value": value})
        else:
            missing.append({
                "header": header,
                "risk": HEADER_RISK.get(header, "Unknown risk."),
            })

    return _ok({
        "url": url,
        "status_code": resp.status_code,
        "present_headers": present,
        "missing_headers": missing,
        "security_score": f"{len(present)}/{len(SECURITY_HEADERS)}",
    })


@app.post("/scan/cert")
def scan_cert(request: CertRequest):
    domain = request.domain.strip()

    try:
        ctx = ssl.create_default_context()
        conn = ctx.wrap_socket(
            socket.create_connection((domain, 443), timeout=10),
            server_hostname=domain,
        )
        cert = conn.getpeercert()
        conn.close()
    except ssl.SSLCertVerificationError as exc:
        return _err(f"SSL verification error: {exc}")
    except socket.timeout:
        return _err("Connection timed out after 10 seconds.")
    except Exception as exc:
        return _err(f"Certificate retrieval failed: {exc}")

    # Parse expiry
    not_after_str = cert.get("notAfter", "")
    try:
        not_after = datetime.strptime(not_after_str, "%b %d %H:%M:%S %Y %Z").replace(
            tzinfo=timezone.utc
        )
        days_until_expiry = (not_after - datetime.now(timezone.utc)).days
        is_expired = days_until_expiry < 0
    except Exception:
        not_after = None
        days_until_expiry = None
        is_expired = None

    # Flatten issuer / subject
    def _dn(tuples):
        return {k: v for pair in tuples for k, v in pair} if tuples else {}

    issuer = _dn(cert.get("issuer", ()))
    subject = _dn(cert.get("subject", ()))

    return _ok({
        "domain": domain,
        "issuer": issuer,
        "subject": subject,
        "not_before": cert.get("notBefore"),
        "not_after": not_after_str,
        "days_until_expiry": days_until_expiry,
        "is_expired": is_expired,
        "san": cert.get("subjectAltName", []),
    })
