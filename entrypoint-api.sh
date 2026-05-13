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

# Step 2: Start the API server
# RLS policies are applied by applyRlsPolicies() in the API at startup.
# This is the single source of truth for RLS (see apps/api/src/db.ts).
# init.sql is kept as reference/documentation only and is NOT executed.
# Uses the tsup-bundled output (single ESM file, no tsx needed)
echo "[entrypoint] Starting Nova API on port ${PORT:-3001}..."
exec node apps/api/dist/index.js
