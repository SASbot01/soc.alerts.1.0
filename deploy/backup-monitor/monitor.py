#!/usr/bin/env python3
"""
BlackWolf SOC — Backup Monitor Agent

Watches backup directories for new/stale backups and reports status
to the SOC backend via /api/v1/backups/report endpoint.

Can also be used as a library: call report_backup() from your own
backup scripts to push status directly.
"""

import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# ── Config ──────────────────────────────────────────────
SOC_API_URL = os.getenv("SOC_API_URL", "http://backend:8080/api/v1")
SOC_API_KEY = os.getenv("SOC_API_KEY", "")
SOC_COMPANY_ID = os.getenv("SOC_COMPANY_ID", "")
CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", "3600"))  # seconds
BACKUP_DIRS = os.getenv("BACKUP_DIRS", "/var/backups").split(",")
MAX_AGE_HOURS = int(os.getenv("MAX_AGE_HOURS", "25"))
CLIENT_HOST = os.getenv("CLIENT_HOST", os.getenv("HOSTNAME", "unknown"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("backup-monitor")

shutdown_requested = False


def handle_signal(signum, _frame):
    global shutdown_requested
    log.info("Received signal %d, shutting down...", signum)
    shutdown_requested = True


def report_backup(job_name: str, status: str, backup_type: str = "full",
                  target: str = None, size_bytes: int = 0,
                  duration_seconds: int = 0, error_message: str = None,
                  started_at: str = None, finished_at: str = None) -> bool:
    """Report a backup job status to the SOC backend."""
    payload = {
        "company_id": SOC_COMPANY_ID,
        "api_key": SOC_API_KEY,
        "client_host": CLIENT_HOST,
        "job_name": job_name,
        "status": status,
        "backup_type": backup_type,
        "target": target,
        "size_bytes": size_bytes,
        "duration_seconds": duration_seconds,
        "error_message": error_message,
        "started_at": started_at,
        "finished_at": finished_at,
    }

    url = f"{SOC_API_URL}/backups/report"
    try:
        resp = requests.post(url, json=payload, timeout=15)
        if resp.status_code == 200:
            log.info("Reported backup: %s [%s] -> success", job_name, status)
            return True
        log.warning("SOC API returned %d: %s", resp.status_code, resp.text[:500])
        return False
    except requests.RequestException as exc:
        log.error("Failed to report backup: %s", exc)
        return False


def scan_backup_directory(backup_dir: str) -> list[dict]:
    """Scan a backup directory and detect backup files with age/size info."""
    results = []
    backup_path = Path(backup_dir)
    if not backup_path.exists():
        log.warning("Backup directory %s does not exist", backup_dir)
        return results

    # Common backup file extensions
    backup_extensions = {
        ".sql", ".sql.gz", ".sql.bz2", ".sql.xz",
        ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tar.xz",
        ".zip", ".7z", ".rar",
        ".bak", ".dump", ".rdb",
        ".img", ".qcow2", ".vmdk",
    }

    # Group files by "job" (directory name or filename prefix)
    jobs: dict[str, list[Path]] = {}
    for f in backup_path.rglob("*"):
        if not f.is_file():
            continue
        if f.suffix.lower() not in backup_extensions and not any(
            ext in f.name.lower() for ext in [".sql", ".tar", ".bak", ".dump"]
        ):
            continue

        job_name = f.parent.name if f.parent != backup_path else f.stem.split(".")[0]
        jobs.setdefault(job_name, []).append(f)

    now = datetime.now(timezone.utc)

    for job_name, files in jobs.items():
        # Get the most recent file
        latest = max(files, key=lambda p: p.stat().st_mtime)
        stat = latest.stat()
        age_hours = (now.timestamp() - stat.st_mtime) / 3600
        total_size = sum(f.stat().st_size for f in files)

        file_time = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)

        if age_hours > MAX_AGE_HOURS:
            status = "STALE"
            error = f"Latest backup is {age_hours:.1f}h old (threshold: {MAX_AGE_HOURS}h)"
        else:
            status = "SUCCESS"
            error = None

        results.append({
            "job_name": job_name,
            "status": status,
            "backup_type": guess_backup_type(latest.suffix),
            "target": str(backup_path),
            "size_bytes": total_size,
            "duration_seconds": 0,
            "error_message": error,
            "started_at": file_time.isoformat(),
            "finished_at": file_time.isoformat(),
        })

    return results


def guess_backup_type(suffix: str) -> str:
    suffix = suffix.lower()
    if suffix in (".sql", ".sql.gz", ".sql.bz2", ".dump"):
        return "database"
    if suffix in (".tar", ".tar.gz", ".tgz", ".zip", ".7z"):
        return "filesystem"
    if suffix in (".img", ".qcow2", ".vmdk"):
        return "image"
    if suffix == ".rdb":
        return "redis"
    return "full"


def main():
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    if not SOC_API_KEY or not SOC_COMPANY_ID:
        log.error("SOC_API_KEY and SOC_COMPANY_ID must be set")
        sys.exit(1)

    log.info("Backup Monitor started")
    log.info("  Directories: %s", BACKUP_DIRS)
    log.info("  Max age: %dh", MAX_AGE_HOURS)
    log.info("  Check interval: %ds", CHECK_INTERVAL)
    log.info("  Client host: %s", CLIENT_HOST)

    while not shutdown_requested:
        for backup_dir in BACKUP_DIRS:
            backup_dir = backup_dir.strip()
            if not backup_dir:
                continue

            log.info("Scanning %s ...", backup_dir)
            try:
                results = scan_backup_directory(backup_dir)
                if not results:
                    # No backups found at all — report as stale
                    report_backup(
                        job_name=f"dir-{Path(backup_dir).name}",
                        status="STALE",
                        target=backup_dir,
                        error_message=f"No backup files found in {backup_dir}",
                    )
                else:
                    for result in results:
                        report_backup(**result)
            except Exception as e:
                log.error("Error scanning %s: %s", backup_dir, e)
                report_backup(
                    job_name=f"dir-{Path(backup_dir).name}",
                    status="FAILED",
                    target=backup_dir,
                    error_message=f"Scan error: {e}",
                )

        # Wait for next check interval
        elapsed = 0
        while elapsed < CHECK_INTERVAL and not shutdown_requested:
            time.sleep(min(10, CHECK_INTERVAL - elapsed))
            elapsed += 10

    log.info("Backup Monitor stopped")


if __name__ == "__main__":
    main()
