#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ألو المعلم · Alo Maalem — one-shot local bootstrap
#
# Makes the project runnable from a clean checkout (or a fresh sandbox) with a
# single command:
#
#   bash scripts/bootstrap.sh            # db up + migrate + seed + nothing else
#   bash scripts/bootstrap.sh --dev      # …then start `next dev` on 0.0.0.0:3000
#
# Idempotent: safe to re-run. Never destroys data unless --reset is passed.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

START_DEV=0
RESET_DB=0
for arg in "$@"; do
  case "$arg" in
    --dev)   START_DEV=1 ;;
    --reset) RESET_DB=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

log()  { printf '\033[0;32m▸\033[0m %s\n' "$1"; }
warn() { printf '\033[0;33m!\033[0m %s\n' "$1"; }
fail() { printf '\033[0;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

# ── 1. Environment file ──────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  log "Creating .env from .env.example"
  cp .env.example .env
  SECRET="$(head -c 48 /dev/urandom | base64 | tr -d '\n=/' | head -c 48 || true)"
  if [[ -n "$SECRET" ]]; then
    python3 - "$SECRET" <<'PY' || true
import re, sys, pathlib
secret = sys.argv[1]
p = pathlib.Path(".env")
p.write_text(re.sub(r'AUTH_SECRET="[^"]*"', f'AUTH_SECRET="{secret}"', p.read_text()))
PY
    log "Generated a random AUTH_SECRET"
  else
    warn "Could not generate AUTH_SECRET — set it manually before running in production"
  fi
else
  log ".env already present"
fi

# ── 2. Dependencies ──────────────────────────────────────────────────────────
if [[ ! -d node_modules || ! -d node_modules/.prisma ]]; then
  log "Installing npm dependencies (this can take a minute)"
  npm install --no-audit --no-fund
else
  log "node_modules present — skipping npm install"
fi

# ── 3. PostgreSQL ────────────────────────────────────────────────────────────
DB_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d'"' -f2)"
DB_USER="$(printf '%s' "$DB_URL" | sed -E 's#.*://([^:]+):.*#\1#')"
DB_PASS="$(printf '%s' "$DB_URL" | sed -E 's#.*://[^:]+:([^@]+)@.*#\1#')"
DB_HOST="$(printf '%s' "$DB_URL" | sed -E 's#.*@([^:/]+).*#\1#')"
DB_PORT="$(printf '%s' "$DB_URL" | sed -E 's#.*@[^:]+:([0-9]+)/.*#\1#')"
DB_NAME="$(printf '%s' "$DB_URL" | sed -E 's#.*/([^?]+).*#\1#')"

if command -v pg_isready >/dev/null 2>&1 && pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
  log "PostgreSQL is already accepting connections on ${DB_HOST}:${DB_PORT}"
elif [[ -d /usr/lib/postgresql ]]; then
  log "Starting local PostgreSQL cluster"
  if command -v pg_ctlcluster >/dev/null 2>&1; then
    for cluster in $(pg_lsclusters -h 2>/dev/null | awk '{print $1" "$2}'); do
      set -- $cluster
      sudo -n pg_ctlcluster "$1" "$2" start >/dev/null 2>&1 || true
    done
  fi
  sleep 2
  pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1 || warn "PostgreSQL did not answer yet — migrations may fail"
else
  warn "No local PostgreSQL found. Point DATABASE_URL at a reachable server, then re-run."
fi

# Create role + database when they do not exist yet.
if command -v psql >/dev/null 2>&1; then
  if ! PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc 'SELECT 1' >/dev/null 2>&1; then
    log "Creating PostgreSQL role '${DB_USER}' and database '${DB_NAME}'"
    sudo -n -u postgres psql -v ON_ERROR_STOP=1 <<SQL >/dev/null 2>&1 || warn "Could not create role/database (already exists, or no sudo?)"
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE "${DB_USER}" LOGIN PASSWORD '${DB_PASS}' CREATEDB;
  END IF;
END \$\$;
SQL
    sudo -n -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q 1 \
      || sudo -n -u postgres createdb -O "$DB_USER" "$DB_NAME" >/dev/null 2>&1 \
      || warn "Could not create database '${DB_NAME}'"
  fi
fi

# ── 4. Prisma: client + migrations ───────────────────────────────────────────
log "Generating the Prisma client"
npx prisma generate >/dev/null

if [[ $RESET_DB -eq 1 ]]; then
  warn "--reset: dropping and recreating the schema"
  npx prisma migrate reset --force --skip-seed >/dev/null
else
  log "Applying database migrations"
  npx prisma migrate deploy >/dev/null || npx prisma migrate dev --skip-seed >/dev/null
fi

# ── 5. Seed ──────────────────────────────────────────────────────────────────
if [[ $RESET_DB -eq 1 || -n "${FORCE_SEED:-}" ]]; then
  log "Seeding demo data"
  npm run db:seed
else
  COUNT="$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc 'SELECT count(*) FROM users' 2>/dev/null || echo 0)"
  if [[ "${COUNT:-0}" == "0" ]]; then
    log "Database is empty — seeding Moroccan demo data"
    npm run db:seed
  else
    log "Database already has ${COUNT} users — skipping seed (use --reset to reseed)"
  fi
fi

log "Bootstrap complete."
cat <<EOF

  Demo accounts (password: Demo@12345)
    admin@alomaalem.ma          → /admin
    customer@alomaalem.ma       → /dashboard
    professional@alomaalem.ma   → /professional

EOF

if [[ $START_DEV -eq 1 ]]; then
  log "Starting the dev server on http://0.0.0.0:3000"
  exec npm run dev
fi
