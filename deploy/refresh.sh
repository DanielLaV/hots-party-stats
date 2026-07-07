#!/bin/bash
# Pulls the latest committed data and regenerates the dashboard.
#
# Run this manually whenever you know new data.csv/players.csv were pushed,
# or schedule it with Unraid's "User Scripts" plugin (e.g. hourly/daily).
#
# The build step runs in a throwaway python container rather than installing
# Python on the Unraid host directly -- keeps the host clean, matches how
# Unraid expects things to run. It only needs the CSVs already in the repo,
# not the actual .StormReplay files or a real replay-parsing environment.
set -euo pipefail

# Defaults -- overridden below by refresh.local.sh, which is git-ignored so
# your machine-specific paths never collide with (or get clobbered by) a
# `git pull` that touches this file.
REPO_DIR="/mnt/user/appdata/hots-dashboard/repo"
WWW_DIR="/mnt/user/appdata/hots-dashboard/www"

# CHANGE ME: create deploy/refresh.local.sh next to this script (it's
# git-ignored) with your own REPO_DIR/WWW_DIR, e.g.:
#   REPO_DIR="/mnt/user/appdata/hots-dashboard/hots-party-stats"
#   WWW_DIR="/mnt/user/appdata/hots-dashboard/hots-party-stats/deploy/www"
LOCAL_CONFIG="$(dirname "$(readlink -f "$0")")/refresh.local.sh"
if [ -f "$LOCAL_CONFIG" ]; then
  source "$LOCAL_CONFIG"
fi

# Same value the hots-api container reads (see docker-compose.yml) -- needed
# here too so the built dashboard's JS can send it as a header on Fearless
# writes. Missing entirely just means the Fearless tab can't save (the rest
# of the dashboard is unaffected), so don't hard-fail refresh.sh over it.
ENV_FILE="$(dirname "$(readlink -f "$0")")/.env"
if [ -f "$ENV_FILE" ]; then
  source "$ENV_FILE"
fi

cd "$REPO_DIR"

# Snapshot games.csv before pulling so we can report how many new games (and
# in which modes) the pull actually brought in -- the CSV itself has no
# memory of what was there before. SNAPSHOT_DIR is separate from $REPO_DIR
# so `git pull` can't touch it.
SNAPSHOT_DIR="$(mktemp -d)"
trap 'rm -rf "$SNAPSHOT_DIR"' EXIT
cp "$REPO_DIR/data/games.csv" "$SNAPSHOT_DIR/games_before.csv" 2>/dev/null || true

# UserKnownHostsFile=/dev/null + accept-new stops ssh from trying (and
# failing) to persist github.com's host key to /root/.ssh/known_hosts --
# that file isn't writable in this container, so every run otherwise prints
# a "hostfile_replace_entries ... Operation not permitted" warning.
echo "Pulling latest changes from git..."
GIT_SSH_COMMAND="ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=accept-new" git pull
# ("Already up to date." above means the repo had no new commits -- that's
# about git, not the dashboard build below, which always reruns regardless.)

echo "Building dashboard (installs deps in a throwaway container first -- can take a few minutes)..."
docker run --rm \
  -v "$REPO_DIR":/repo \
  -v "$SNAPSHOT_DIR":/snapshot \
  -w /repo \
  -e FEARLESS_API_TOKEN="${FEARLESS_API_TOKEN:-}" \
  python:3.11-slim \
  bash -c "export DEBIAN_FRONTEND=noninteractive && apt-get update -qq && apt-get install -y -qq --no-install-recommends git > /dev/null && pip install --quiet --disable-pip-version-check --root-user-action=ignore -r requirements.txt && python build_dashboard.py && python deploy/count_new_games.py /snapshot/games_before.csv data/games.csv"

mkdir -p "$WWW_DIR"
cp "$REPO_DIR/dashboard.html" "$WWW_DIR/index.html"

echo "Dashboard refreshed at $(date)"
