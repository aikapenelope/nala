/**
 * Run Drizzle migrations with proper connection cleanup.
 *
 * This script replaces `drizzle-kit migrate` CLI because the CLI uses
 * postgres.js but never calls sql.end(), causing the process to hang.
 *
 * It handles the one-time bootstrap for databases created by the old
 * `drizzle-kit push --force` flow: if tables already exist but the
 * migration journal doesn't, it creates the journal and seeds all
 * pre-existing migration records so the migrator only runs NEW migrations.
 */

import { readdir } from "node:fs/promises";
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
  // Check if this is a push-era database (tables exist but no migration journal)
  const tables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'businesses'
  `;

  const journalExists = await sql`
    SELECT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'drizzle' AND tablename = '__drizzle_migrations'
    ) AS exists
  `;

  const hasTables = tables.length > 0;
  const hasJournal = journalExists[0]?.exists === true;

  if (hasTables && !hasJournal) {
    console.log("[migrate] Push-era database detected. Bootstrapping migration journal...");

    // Create the drizzle schema and migrations table
    await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await sql`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT
      )
    `;

    // Read all migration files and determine which ones to seed.
    // We seed all migrations EXCEPT those that create tables that don't exist yet.
    // This way, the migrator will only run the truly new migrations.
    const files = await readdir("./drizzle");
    const sqlFiles = files.filter(f => f.endsWith(".sql")).sort();

    // Tables that exist in the DB right now
    const existingTables = await sql`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    const existingTableNames = new Set(existingTables.map(t => t.tablename));

    // Migration 0014 creates 'orders' and 'store_settings'.
    // If those tables don't exist, DON'T seed that migration (let migrator run it).
    for (const file of sqlFiles) {
      const hash = file.replace(".sql", "");

      // Check if this migration creates tables that don't exist yet
      if (hash === "0014_storefront_orders" &&
          (!existingTableNames.has("orders") || !existingTableNames.has("store_settings"))) {
        console.log(`[migrate]   SKIP ${hash} (tables don't exist yet, will be created)`);
        continue;
      }

      // Seed this migration as already applied
      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${Date.now()})
      `;
      console.log(`[migrate]   Seeded ${hash}`);
    }

    console.log("[migrate] Bootstrap complete. Running migrator for remaining migrations...");
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
