# Deploying to Unraid + SWAG

This serves the dashboard as a static site behind SWAG at `hots.yourdomain.example.com`,
plus a small API container for anything that needs a live, shared, writable
backend (currently just the Fearless draft tracker: see `../api/`).

- `docker-compose.yml`: `hots-dashboard` (tiny `nginx:alpine`, serves the
  generated dashboard; never needs rebuilding just because the data changed)
  and `hots-api` (the Flask app in `../api/`, built from source).
- `refresh.sh`: pulls the repo and regenerates the dashboard into the
  folder `hots-dashboard` serves. Run manually or on a schedule.
- `hots.subdomain.conf`: the SWAG reverse-proxy config, routing `/api/` to
  `hots-api` and everything else to `hots-dashboard`, both on the same
  domain (no CORS needed).
- `.env.example`: template for `.env` (git-ignored), which holds the
  shared-secret token that gates Fearless writes.

## One-time setup

1. On the Unraid box, clone the repo somewhere under `/mnt/user/appdata/`,
   e.g. `/mnt/user/appdata/hots-dashboard/repo`.
2. Create `deploy/refresh.local.sh` (git-ignored, so a future `git pull` can
   never conflict with or overwrite it) setting `REPO_DIR`/`WWW_DIR` to match
   wherever you actually cloned the repo, e.g.:
   ```
   REPO_DIR="/mnt/user/appdata/hots-dashboard/repo"
   WWW_DIR="/mnt/user/appdata/hots-dashboard/repo/deploy/www"
   ```
3. Create `deploy/.env` from `.env.example` with a real random token:
   ```
   cp .env.example .env
   sed -i "s/changeme/$(openssl rand -hex 24)/" .env
   ```
   Both `hots-api` (via `docker-compose.yml`) and `refresh.sh` (to embed the
   same value into the built dashboard) read this file.
4. Check what docker network your SWAG container is on
   (`docker inspect swag` or your SWAG compose file/template), and update
   `proxynet` in `docker-compose.yml` to match if it's named differently.
5. Run `refresh.sh` once by hand to populate `./www` with an initial
   `index.html` (the compose file won't have anything to serve until this
   has run at least once).
6. `docker compose up -d` from this `deploy/` directory to build `hots-api`
   and start both containers.
7. Copy `hots.subdomain.conf` into SWAG's `nginx/proxy-confs/` folder (see
   comments in that file) and restart SWAG.
8. Point a CNAME (or A record) for `hots.yourdomain.example.com` at your SWAG instance,
   and make sure that subdomain is covered by SWAG's certificate (automatic
   with a wildcard cert; otherwise add "hots" to SWAG's `SUBDOMAINS` list and
   restart it).

## Keeping it updated

Add `refresh.sh` as a scheduled script in Unraid's **User Scripts** plugin
(hourly/daily, whatever cadence makes sense), or just run it by hand whenever
you know new `data/games.csv`/`data/players.csv` were pushed. Either way, the
`hots-dashboard` container itself never needs to be touched or restarted;
nginx just serves whatever `index.html` is currently on disk.

If you change anything under `../api/` (a new endpoint, a dependency bump),
you do need to rebuild and restart that one container:
```
docker compose up -d --build hots-api
```

## Fearless persistence

`hots-api` stores the Fearless board as `deploy/api-data/fearless_state.json`
(git-ignored, mounted into the container; see `docker-compose.yml`), so it
survives container restarts. Writes require the `X-Api-Token` header to
match `FEARLESS_API_TOKEN` from `.env`; reads don't. This is a shared-secret
deterrent (the token is visible in the dashboard's page source to anyone who
opens devtools), not real per-user auth; see `api/auth.py`.
