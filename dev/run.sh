#!/bin/bash
# Spins up a local dashboard + Fearless API for testing, without touching
# the real Unraid/SWAG deployment. See README's "Running it locally" section.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

export FEARLESS_API_TOKEN="${FEARLESS_API_TOKEN:-dev-token}"

ROOT="$(cd .. && pwd)"
PYTHON="$ROOT/venv/bin/python"
if [ ! -x "$PYTHON" ]; then
  echo "No venv found at $ROOT/venv -- run the Setup steps in the README first." >&2
  exit 1
fi

(cd "$ROOT" && FEARLESS_API_TOKEN="$FEARLESS_API_TOKEN" "$PYTHON" build_dashboard.py)
mkdir -p www
cp "$ROOT/dashboard.html" www/index.html

docker compose up -d --build
echo
echo "Dashboard: http://localhost:8080"
echo "(Fearless writes use FEARLESS_API_TOKEN=$FEARLESS_API_TOKEN -- only matters if you're calling the API directly instead of through the page.)"
