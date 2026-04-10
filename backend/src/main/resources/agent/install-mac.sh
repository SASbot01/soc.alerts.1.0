#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# BlackWolf SOC Agent — macOS Installer
#
# Installs the BlackWolf SOC agent as a launchd service on macOS.
#
# Usage:
#   sudo ./install-mac.sh --url <SOC_URL> --key <API_KEY> --company <COMPANY_ID>
#
# Or interactively:
#   sudo ./install-mac.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

AGENT_DIR="/opt/blackwolf-agent"
CONFIG_DIR="/etc/blackwolf-agent"
SERVICE_LABEL="io.blackwolf.agent"
PLIST_PATH="/Library/LaunchDaemons/${SERVICE_LABEL}.plist"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

banner() {
    echo -e "${CYAN}"
    echo "  ╔══════════════════════════════════════╗"
    echo "  ║  BLACKWOLF SOC AGENT INSTALLER (Mac) ║"
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

# ── Check Python3 ──
log_info "Checking Python3..."
if ! command -v python3 &>/dev/null; then
    log_err "Python3 not found. Install via: brew install python3 or xcode-select --install"
    exit 1
fi
log_ok "Python3: $(python3 --version)"

# ── Create directories ──
log_info "Creating directories..."
mkdir -p "$AGENT_DIR" "$CONFIG_DIR"
log_ok "Directories created"

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
    "auth_log": "/var/log/system.log",
    "fim_paths": [
        "/etc/hosts", "/etc/resolv.conf", "/etc/pam.d/sudo",
        "/etc/ssh/sshd_config", "/etc/shells"
    ],
    "fim_dirs": [
        "/etc/cron.d", "/Library/LaunchDaemons", "/Library/LaunchAgents"
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

# ── Create launchd plist ──
log_info "Creating launchd service..."

# Unload if exists
launchctl unload "$PLIST_PATH" 2>/dev/null || true

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${AGENT_DIR}/venv/bin/python3</string>
        <string>${AGENT_DIR}/blackwolf-agent.py</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>AGENT_CONFIG</key>
        <string>${CONFIG_DIR}/agent.conf</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/blackwolf-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/blackwolf-agent.log</string>
</dict>
</plist>
EOF

launchctl load "$PLIST_PATH"
log_ok "Service created and started"

# ── Verify ──
sleep 2
if launchctl list | grep -q "$SERVICE_LABEL"; then
    log_ok "Agent is running!"
else
    log_err "Agent may not have started. Check: tail -f /var/log/blackwolf-agent.log"
    exit 1
fi

echo ""
echo -e "${GREEN}  ═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Installation complete!${NC}"
echo -e "${GREEN}  ═══════════════════════════════════════${NC}"
echo ""
echo "  Useful commands:"
echo "    Status : launchctl list | grep blackwolf"
echo "    Logs   : tail -f /var/log/blackwolf-agent.log"
echo "    Config : $CONFIG_DIR/agent.conf"
echo "    Restart: sudo launchctl unload $PLIST_PATH && sudo launchctl load $PLIST_PATH"
echo "    Remove : sudo ./uninstall-mac.sh"
echo ""
