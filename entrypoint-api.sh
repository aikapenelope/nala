#!/bin/sh
set -e

# ============================================
# Nova API Entrypoint
#
# Runs on every deploy before starting the server:
# 1. migrate.mjs: applies versioned SQL migrations
# 2. init.sql: applies RLS policies (idempotent, safe to re-run)
# 3. Starts the Hono API server
# ============================================

# Step 1: Apply versioned Drizzle migrations
# Uses DATABASE_URL directly (port 5432, not PgBouncer).
# Only applies new migrations that haven't been run yet (safe on every deploy).
# Migrations MUST succeed -- if they fail, the container should not start.
# See packages/db/migrate.mjs for details on the bootstrap logic.
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Running migrations..."
  cd packages/db && node migrate.mjs 2>&1
  cd /app
  echo "[entrypoint] Migrations complete."
else
  echo "[entrypoint] WARNING: DATABASE_URL not set, skipping migrations."
fi

# Step 2: Apply RLS policies via psql
# init.sql uses DO blocks with pg_tables checks for tables that may not
# exist yet (e.g., orders, store_settings before migration 0014 runs).
# Errors here are non-fatal: the API's applyRlsPolicies() also applies
# policies at startup, so psql failures are logged but don't block boot.
if [ -n "$DATABASE_URL" ] && [ -f "packages/db/init.sql" ]; then
  echo "[entrypoint] Applying RLS policies..."
  if ! psql "$DATABASE_URL" -f packages/db/init.sql 2>&1; then
    echo "[entrypoint] WARNING: init.sql had errors (see above). The API will retry RLS at startup."
  fi
  echo "[entrypoint] RLS policies step complete."
fi

# Step 3: Start the API server
# Uses the tsup-bundled output (single ESM file, no tsx needed)
echo "[entrypoint] Starting Nova API on port ${PORT:-3001}..."
exec node apps/api/dist/index.js
