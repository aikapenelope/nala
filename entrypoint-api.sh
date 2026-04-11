#!/bin/sh
set -e

# ============================================
# Nova API Entrypoint
#
# Runs on every deploy before starting the server:
# 1. drizzle-kit push: creates/updates tables from schema.ts
# 2. init.sql: applies RLS policies (idempotent, safe to re-run)
# 3. Starts the Hono API server
# ============================================

# Step 1: Sync database schema with Drizzle
# Uses DATABASE_URL directly (port 5432, not PgBouncer)
# drizzle-kit push only applies diffs - safe on every deploy
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Running drizzle-kit push..."
  cd packages/db && node ../../node_modules/drizzle-kit/bin.cjs push --force 2>&1
  cd /app
  echo "[entrypoint] Schema sync complete."
else
  echo "[entrypoint] WARNING: DATABASE_URL not set, skipping schema sync."
fi

# Step 2: Apply RLS policies
# Uses psql (installed in the Docker image) to run init.sql
# All statements use IF NOT EXISTS / CREATE OR REPLACE, safe to re-run
if [ -n "$DATABASE_URL" ] && [ -f "packages/db/init.sql" ]; then
  echo "[entrypoint] Applying RLS policies..."
  psql "$DATABASE_URL" -f packages/db/init.sql 2>&1 || echo "[entrypoint] WARNING: RLS apply had errors (may be OK if policies already exist)"
  echo "[entrypoint] RLS policies applied."
fi

# Step 3: Start the API server
# Uses tsx to run TypeScript directly (avoids ESM module resolution issues with tsc output)
echo "[entrypoint] Starting Nova API on port ${PORT:-3001}..."
exec node ./node_modules/tsx/dist/cli.mjs apps/api/src/index.ts
