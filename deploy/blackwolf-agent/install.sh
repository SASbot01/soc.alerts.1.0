#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# BlackWolf SOC Agent — Installer
#
# Installs the BlackWolf SOC agent as a systemd service on Linux.
#
# Usage:
#   sudo ./install.sh --url <SOC_URL> --key <API_KEY> --company <COMPANY_ID>
#
# Or interactively:
#   sudo ./install.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

AGENT_DIR="/opt/blackwolf-agent"
CONFIG_DIR="/etc/blackwolf-agent"
SERVICE_NAME="blackwolf-agent"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

banner() {
    echo -e "${CYAN}"
    echo "  ╔══════════════════════════════════════╗"
    echo "  ║     BLACKWOLF SOC AGENT INSTALLER    ║"
    echo "  ║            v1.0.0                    ║"
    echo "  ╚══════════════════════════════════════╝"
    echo -e "${NC}"
}

log_ok()   { echo -e "  ${GREEN}[OK]${NC} $*"; }
log_info() { echo -e "  ${YELLOW}[>>]${NC} $*"; }
log_err()  { echo -e "  ${RED}[!!]${NC} $*"; }

# ── Parse arguments ──
SOC_URL=""
API_KEY=""
COMPANY_ID=""
SENSOR_ID="agent-$(hostname)"

while [[ $# -gt 0 ]]; do
    case $1 in
        --url) SOC_URL="$2"; shift 2 ;;
        --key) API_KEY="$2"; shift 2 ;;
        --company) COMPANY_ID="$2"; shift 2 ;;
        --sensor-id) SENSOR_ID="$2"; shift 2 ;;
        *) shift ;;
    esac
done

banner

# ── Root check ──
if [ "$(id -u)" -ne 0 ]; then
    log_err "Must run as root (sudo)"
    exit 1
fi

# ── Interactive if missing params ──
if [ -z "$SOC_URL" ]; then
    read -rp "  SOC URL (e.g., https://soc.blackwolfsec.io/api/v1): " SOC_URL
fi
if [ -z "$API_KEY" ]; then
    read -rp "  API Key: " API_KEY
fi
if [ -z "$COMPANY_ID" ]; then
    read -rp "  Company ID: " COMPANY_ID
fi

if [ -z "$SOC_URL" ] || [ -z "$API_KEY" ] || [ -z "$COMPANY_ID" ]; then
    log_err "SOC URL, API Key, and Company ID are required"
    exit 1
fi

# ── Install Python dependency ──
log_info "Checking Python3..."
if ! command -v python3 &>/dev/null; then
    log_info "Installing Python3..."
    if command -v apt-get &>/dev/null; then
        apt-get update -qq && apt-get install -y -qq python3 python3-pip
    elif command -v yum &>/dev/null; then
        yum install -y python3 python3-pip
    elif command -v dnf &>/dev/null; then
        dnf install -y python3 python3-pip
    else
        log_err "Cannot install Python3 automatically. Install manually."
        exit 1
    fi
fi
log_ok "Python3: $(python3 --version)"

# ── Create directories ──
log_info "Creating directories..."
mkdir -p "$AGENT_DIR" "$CONFIG_DIR"
log_ok "Directories created"

# ── Install python3-venv if needed ──
if ! python3 -m venv --help &>/dev/null; then
    log_info "Installing python3-venv..."
    if command -v apt-get &>/dev/null; then
        apt-get install -y -qq python3-venv
    fi
fi

# ── Create venv and install dependencies (PEP 668 safe) ──
log_info "Creating Python virtual environment..."
python3 -m venv "$AGENT_DIR/venv"
"$AGENT_DIR/venv/bin/pip" install --quiet requests
log_ok "Virtual environment created with requests module"

# ── Copy agent ──
log_info "Installing agent..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$SCRIPT_DIR/blackwolf-agent.py" "$AGENT_DIR/blackwolf-agent.py"
chmod +x "$AGENT_DIR/blackwolf-agent.py"
log_ok "Agent installed to $AGENT_DIR"

# ── Write config ──
log_info "Writing configuration..."
cat > "$CONFIG_DIR/agent.conf" <<EOF
{
    "soc_url": "${SOC_URL}",
    "api_key": "${API_KEY}",
    "company_id": "${COMPANY_ID}",
    "sensor_id": "${SENSOR_ID}",
    "heartbeat_interval": 60,
    "fim_interval": 300,
    "process_interval": 30,
    "network_interval": 60,
    "auth_log": "/var/log/auth.log",
    "fim_paths": [
        "/etc/passwd", "/etc/shadow", "/etc/sudoers", "/etc/ssh/sshd_config",
        "/etc/crontab", "/etc/hosts", "/etc/resolv.conf",
        "/root/.ssh/authorized_keys", "/root/.bashrc"
    ],
    "fim_dirs": [
        "/etc/cron.d", "/etc/cron.daily", "/etc/sudoers.d"
    ],
    "suspicious_processes": [
        "ncat", "nc.traditional", "nmap", "masscan", "hydra", "john",
        "hashcat", "mimikatz", "meterpreter", "cobalt", "empire",
        "chisel", "plink", "socat", "cryptominer", "xmrig"
    ],
    "suspicious_ports": [4444, 5555, 8888, 1234, 31337, 9001, 9002],
    "max_batch_size": 50
}
EOF
chmod 600 "$CONFIG_DIR/agent.conf"
log_ok "Config: $CONFIG_DIR/agent.conf"

# ── Create systemd service ──
log_info "Creating systemd service..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=BlackWolf SOC Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${AGENT_DIR}/venv/bin/python3 ${AGENT_DIR}/blackwolf-agent.py
Restart=always
RestartSec=10
Environment=AGENT_CONFIG=${CONFIG_DIR}/agent.conf
StandardOutput=journal
StandardError=journal
SyslogIdentifier=blackwolf-agent

# Security hardening
NoNewPrivileges=false
ProtectSystem=strict
ReadWritePaths=/etc/blackwolf-agent
ProtectHome=read-only

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"
log_ok "Service created and started"

# ── Verify ──
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
    log_ok "Agent is running!"
else
    log_err "Agent failed to start. Check: journalctl -u $SERVICE_NAME"
    exit 1
fi

echo ""
echo -e "${GREEN}  ═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Installation complete!${NC}"
echo -e "${GREEN}  ═══════════════════════════════════════${NC}"
echo ""
echo "  Useful commands:"
echo "    Status : systemctl status $SERVICE_NAME"
echo "    Logs   : journalctl -u $SERVICE_NAME -f"
echo "    Config : $CONFIG_DIR/agent.conf"
echo "    Restart: systemctl restart $SERVICE_NAME"
echo "    Remove : systemctl stop $SERVICE_NAME && systemctl disable $SERVICE_NAME"
echo ""
