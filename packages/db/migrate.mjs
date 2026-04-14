/**
 * Run Drizzle migrations with proper connection cleanup.
 *
 * This script replaces `drizzle-kit migrate` CLI because the CLI uses
 * postgres.js but never calls sql.end(), causing the process to hang.
 *
 * It also handles the one-time bootstrap for databases created by the
 * old `drizzle-kit push --force` flow: if tables already exist but
 * migration 0000 is not registered, it seeds the migration record so
 * the migrator skips the initial CREATE TABLEs.
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  // One-time bootstrap: if the DB was created by drizzle-kit push (pre-migration era),
  // the tables exist but migration 0000 is not registered in __drizzle_migrations.
  // The migrator would try to run the CREATE TABLEs and fail with 'already exists'.
  // Detect this case and seed the migration record so the migrator skips it.
  try {
    const tables = await sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'businesses'
    `;
    if (tables.length > 0) {
      const applied = await sql`
        SELECT id FROM drizzle.__drizzle_migrations
        WHERE hash = '0000_curious_ulik'
        LIMIT 1
      `.catch(() => []);
      if (applied.length === 0) {
        console.log(
          "[migrate] Seeding migration 0000 record (tables already exist from push era)",
        );
        await sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES ('0000_curious_ulik', ${Date.now()})
        `;
      }
    }
  } catch {
    // __drizzle_migrations table may not exist yet (fresh DB). That is fine,
    // the migrator will create it and run migration 0000 normally.
  }

  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] Migrations applied successfully");
} catch (err) {
  console.error("[migrate] Migration failed:", err);
  process.exit(1);
} finally {
  await sql.end();
}
