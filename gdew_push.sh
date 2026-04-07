#!/bin/bash
# =============================================================
# gdew_push.sh — GDEW Precipitation Dashboard Git Push
# First run: sets up git config, remote, and pushes.
# Later runs: just commits and pushes changes.
# Usage:  bash ~/gdew/precip-dashboard/gdew_push.sh "your commit message"
# =============================================================

set -e

APP_DIR="/home/bravoapp/gdew/precip-dashboard"
REMOTE_URL="https://github.com/developerndma/gdew_dashboard.git"
BRANCH="main"

# ── Git identity (one-time, stored globally) ──────────────────
GIT_USER="developerndma"
GIT_EMAIL="developer@ndma.gov.pk"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Precipitation Dashboard — Git Push     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

cd "$APP_DIR"
echo "[INFO] Working directory: $(pwd)"

# ── 1. One-time git config ────────────────────────────────────
echo "[1/5] Checking git config..."
CURRENT_USER=$(git config --global user.name 2>/dev/null || echo "")
CURRENT_EMAIL=$(git config --global user.email 2>/dev/null || echo "")

if [ -z "$CURRENT_USER" ] || [ -z "$CURRENT_EMAIL" ]; then
    echo "      Setting git identity..."
    git config --global user.name "$GIT_USER"
    git config --global user.email "$GIT_EMAIL"
    echo "      ✓ Git identity set: $GIT_USER <$GIT_EMAIL>"
else
    echo "      ✓ Git identity already set: $CURRENT_USER <$CURRENT_EMAIL>"
fi

# ── 2. Ensure git repo is initialized ────────────────────────
echo "[2/5] Checking git repo..."
if [ ! -d ".git" ]; then
    echo "      Initializing git repo..."
    git init
    git branch -M "$BRANCH"
    echo "      ✓ Git repo initialized"
else
    echo "      ✓ Git repo already initialized"
fi

# ── 3. Ensure remote is set ───────────────────────────────────
echo "[3/5] Checking remote..."
EXISTING_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$EXISTING_REMOTE" ]; then
    echo "      Adding remote origin..."
    git remote add origin "$REMOTE_URL"
    echo "      ✓ Remote added: $REMOTE_URL"
elif [ "$EXISTING_REMOTE" != "$REMOTE_URL" ]; then
    echo "      Updating remote origin..."
    git remote set-url origin "$REMOTE_URL"
    echo "      ✓ Remote updated: $REMOTE_URL"
else
    echo "      ✓ Remote already set: $REMOTE_URL"
fi

# ── 4. Stage all changes ──────────────────────────────────────
echo "[4/5] Staging changes..."
git add -A

# Check if there's anything to commit
if git diff --cached --quiet; then
    echo "      ⚠  No changes to commit. Everything is up to date."
    echo ""
    exit 0
fi

# Commit message from argument or prompt
if [ -n "$1" ]; then
    COMMIT_MSG="$1"
else
    echo ""
    read -p "      Enter commit message: " COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="Update $(date '+%Y-%m-%d %H:%M')"
    fi
fi

git commit -m "$COMMIT_MSG"
echo "      ✓ Committed: $COMMIT_MSG"

# ── 5. Push to GitHub ─────────────────────────────────────────
echo "[5/5] Pushing to GitHub..."
git branch -M "$BRANCH"
git push -u origin "$BRANCH"
echo "      ✓ Pushed to $REMOTE_URL"

echo ""
echo "  ✅  Done! Changes are live on GitHub."
echo "  🔗  https://github.com/developerndma/gdew_dashboard"
echo ""