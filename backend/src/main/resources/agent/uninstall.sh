#!/usr/bin/env bash
# BlackWolf SOC Agent — Uninstaller
set -euo pipefail

SERVICE_NAME="blackwolf-agent"
AGENT_DIR="/opt/blackwolf-agent"
CONFIG_DIR="/etc/blackwolf-agent"

echo "Uninstalling BlackWolf SOC Agent..."

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    systemctl stop "$SERVICE_NAME"
    echo "  Stopped service"
fi

if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    systemctl disable "$SERVICE_NAME"
    echo "  Disabled service"
fi

rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload 2>/dev/null || true
echo "  Removed systemd service"

rm -rf "$AGENT_DIR"
echo "  Removed $AGENT_DIR"

rm -rf "$CONFIG_DIR"
echo "  Removed $CONFIG_DIR"

echo "Done. BlackWolf SOC Agent has been removed."
