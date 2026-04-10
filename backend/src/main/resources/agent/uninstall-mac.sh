#!/usr/bin/env bash
# BlackWolf SOC Agent — macOS Uninstaller
set -euo pipefail

SERVICE_LABEL="io.blackwolf.agent"
PLIST_PATH="/Library/LaunchDaemons/${SERVICE_LABEL}.plist"
AGENT_DIR="/opt/blackwolf-agent"
CONFIG_DIR="/etc/blackwolf-agent"

echo "Uninstalling BlackWolf SOC Agent (macOS)..."

if launchctl list | grep -q "$SERVICE_LABEL" 2>/dev/null; then
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    echo "  Stopped service"
fi

rm -f "$PLIST_PATH"
echo "  Removed launchd plist"

rm -rf "$AGENT_DIR"
echo "  Removed $AGENT_DIR"

rm -rf "$CONFIG_DIR"
echo "  Removed $CONFIG_DIR"

rm -f /var/log/blackwolf-agent.log
echo "  Removed log file"

echo "Done. BlackWolf SOC Agent has been removed."
