#!/bin/bash
# =============================================================
# deploy_precip.sh — Precipitation Dashboard (dovclocknote.ndma.gov.pk : 5004)
# No build step — Vite dev server serves source files directly.
# Usage:  bash ~/gdew/precip-dashboard/deploy_precip.sh
# =============================================================

set -e

APP_DIR="/home/bravoapp/gdew/precip-dashboard"
SERVICE="precipitation-dashboard"
NPM="/home/bravoapp/.nvm/versions/node/v22.22.1/bin/npm"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Precipitation Dashboard — Deploy       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Move into project folder ───────────────────────────────
cd "$APP_DIR"
echo "[1/3] Working directory: $(pwd)"

# ── 2. Install/update dependencies if package.json changed ───
echo "[2/3] Checking dependencies..."
$NPM install --prefer-offline 2>&1 | tail -3
echo "      ✓ Dependencies OK"

# ── 3. Restart the service ────────────────────────────────────
echo "[3/3] Restarting service..."
sudo systemctl daemon-reload
sudo systemctl restart "$SERVICE"
sleep 2

# ── Health check ─────────────────────────────────────────────
STATUS=$(sudo systemctl is-active "$SERVICE")
if [ "$STATUS" = "active" ]; then
    echo ""
    echo "  ✅  Service is running."
    echo "  🌐  https://dovclocknote.ndma.gov.pk"
    echo "  🖥   http://127.0.0.1:5004"
else
    echo ""
    echo "  ❌  Service did not start. Last 20 log lines:"
    sudo journalctl -u "$SERVICE" -n 20 --no-pager
    exit 1
fi

echo ""