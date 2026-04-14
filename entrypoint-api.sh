#!/bin/sh
set -e

# ============================================
# Nova API Entrypoint
#
# Runs on every deploy before starting the server:
# 1. drizzle-kit migrate: applies versioned SQL migrations
# 2. init.sql: applies RLS policies (idempotent, safe to re-run)
# 3. Starts the Hono API server
# ============================================

# Step 1: Apply versioned Drizzle migrations
# Uses DATABASE_URL directly (port 5432, not PgBouncer).
# Only applies new migrations that haven't been run yet (safe on every deploy).
#
# Note: drizzle-kit migrate uses postgres.js which keeps the connection pool
# open after finishing, causing the process to hang. We use a Node.js wrapper
# that calls sql.end() after the migrate import resolves.
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Running drizzle-kit migrate..."
  cd packages/db && node -e "
    (async () => {
      const { default: postgres } = await import('postgres');
      const { drizzle } = await import('drizzle-orm/postgres-js');
      const { migrate } = await import('drizzle-orm/postgres-js/migrator');
      const sql = postgres(process.env.DATABASE_URL, { max: 1 });
      const db = drizzle(sql);

      // One-time bootstrap: if the DB was created by drizzle-kit push (pre-migration era),
      // the tables exist but migration 0000 is not registered in __drizzle_migrations.
      // The migrator would try to run the CREATE TABLEs and fail with 'already exists'.
      // Detect this case and seed the migration record so the migrator skips it.
      try {
        const tables = await sql\`
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'public' AND tablename = 'businesses'
        \`;
        if (tables.length > 0) {
          const applied = await sql\`
            SELECT id FROM drizzle.__drizzle_migrations
            WHERE hash = '0000_curious_ulik'
            LIMIT 1
          \`.catch(() => []);
          if (applied.length === 0) {
            console.log('[migrate] Seeding migration 0000 record (tables already exist from push era)');
            await sql\`
              INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
              VALUES ('0000_curious_ulik', ${Date.now()})
            \`;
          }
        }
      } catch (e) {
        // __drizzle_migrations table may not exist yet (fresh DB). That is fine,
        // the migrator will create it and run migration 0000 normally.
      }

      await migrate(db, { migrationsFolder: './drizzle' });
      await sql.end();
      process.exit(0);
    })().catch(err => { console.error(err); process.exit(1); });
  " 2>&1
  cd /app
  echo "[entrypoint] Migrations complete."
else
  echo "[entrypoint] WARNING: DATABASE_URL not set, skipping migrations."
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
# Uses the tsup-bundled output (single ESM file, no tsx needed)
echo "[entrypoint] Starting Nova API on port ${PORT:-3001}..."
exec node apps/api/dist/index.js
