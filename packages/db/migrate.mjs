/**
 * Run Drizzle migrations with proper connection cleanup.
 *
 * This script replaces `drizzle-kit migrate` CLI because the CLI uses
 * postgres.js but never calls sql.end(), causing the process to hang.
 *
 * It handles the one-time bootstrap for databases created by the old
 * `drizzle-kit push --force` flow: tables exist but the migration journal
 * table (`drizzle.__drizzle_migrations`) does not. The bootstrap reads
 * `_journal.json`, computes the same SHA-256 hashes the migrator uses,
 * and seeds records for every migration whose effects are already present
 * in the database. The migrator then only runs truly new migrations.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

/**
 * Compute the SHA-256 hash of a migration file's SQL content.
 * This must match the hash that drizzle-orm's migrator computes internally.
 */
function hashMigrationSql(filePath) {
  const content = readFileSync(filePath, "utf-8");
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Read the canonical migration journal.
 * Returns the entries array from `drizzle/meta/_journal.json`.
 */
function readJournal() {
  const raw = readFileSync("./drizzle/meta/_journal.json", "utf-8");
  return JSON.parse(raw).entries;
}

/**
 * Check which public tables exist in the database.
 * Returns a Set of table names.
 */
async function getExistingTables() {
  const rows = await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  return new Set(rows.map((r) => r.tablename));
}

/**
 * Detect whether the drizzle migration journal table exists.
 */
async function hasJournalTable() {
  const rows = await sql`
    SELECT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'drizzle' AND tablename = '__drizzle_migrations'
    ) AS exists
  `;
  return rows[0]?.exists === true;
}

/**
 * Bootstrap: seed the migration journal for push-era databases.
 *
 * Strategy:
 * 1. Read _journal.json to get the canonical list of migrations.
 * 2. For each migration, check if its effects are already in the DB
 *    (i.e., the tables it creates already exist).
 * 3. If yes, seed the migration record with the correct SHA-256 hash.
 * 4. If no, skip it so the migrator will run it.
 *
 * This is conservative: migrations that only ALTER existing tables
 * (add columns, create indexes) are assumed to have been applied by
 * `drizzle-kit push` if the base table exists. The ALTER statements
 * use IF NOT EXISTS / IF EXISTS patterns, so re-running them is safe.
 */
async function bootstrapPushEraDb() {
  const existingTables = await getExistingTables();
  const journalHasTable = await hasJournalTable();

  // Only bootstrap if tables exist but the journal doesn't
  const isPushEra = existingTables.has("businesses") && !journalHasTable;
  if (!isPushEra) return;

  console.log(
    "[migrate] Push-era database detected (tables exist, no migration journal).",
  );
  console.log("[migrate] Bootstrapping migration journal...");

  // Create the drizzle schema and migrations table
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT
    )
  `;

  const journal = readJournal();

  // Tables that each migration creates. Migrations not listed here only
  // ALTER existing tables (add columns, indexes, drop columns) and are
  // safe to re-run, so we seed them if the base table exists.
  const migrationCreatedTables = {
    "0014_storefront_orders": ["orders", "store_settings"],
  };

  let seeded = 0;
  let skipped = 0;

  for (const entry of journal) {
    const tag = entry.tag;
    const filePath = `./drizzle/${tag}.sql`;
    const hash = hashMigrationSql(filePath);

    // Check if this migration creates tables that don't exist yet
    const createdTables = migrationCreatedTables[tag];
    if (createdTables) {
      const allExist = createdTables.every((t) => existingTables.has(t));
      if (!allExist) {
        const missing = createdTables.filter((t) => !existingTables.has(t));
        console.log(
          `[migrate]   SKIP ${tag} (tables missing: ${missing.join(", ")})`,
        );
        skipped++;
        continue;
      }
    }

    // Seed this migration as already applied
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${Date.now()})
    `;
    console.log(`[migrate]   Seeded ${tag}`);
    seeded++;
  }

  console.log(
    `[migrate] Bootstrap complete: ${seeded} seeded, ${skipped} pending.`,
  );
}

try {
  // Ensure required PostgreSQL extensions exist before running migrations.
  // In production these are created by init.sql at container startup, but
  // in CI the database is bare. Migrations (0000) depend on pg_trgm for
  // GIN trigram indexes on product/customer name search.
  await sql`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`;
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

  await bootstrapPushEraDb();

  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] Migrations applied successfully");
} catch (err) {
  console.error("[migrate] Migration failed:", err);
  process.exit(1);
} finally {
  await sql.end();
}
