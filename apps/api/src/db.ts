/**
 * Database singleton for the API server.
 *
 * Initializes a single Drizzle ORM instance at startup.
 * Routes access it via `getDb()` rather than creating per-request connections.
 */

import { createDb, type Database } from "@nova/db";

let _db: Database | null = null;

/**
 * Initialize the database connection.
 * Call once at server startup. Throws if DATABASE_URL is not set.
 */
export function initDb(): Database {
  if (_db) return _db;
  _db = createDb();
  return _db;
}

/**
 * Get the database instance.
 * Throws if `initDb()` has not been called yet.
 */
export function getDb(): Database {
  if (!_db) {
    throw new Error("Database not initialized. Call initDb() at startup.");
  }
  return _db;
}

/**
 * Get the database instance if available, or null.
 * Used by health checks and other non-critical paths that should
 * not crash when the database is not configured.
 */
export function tryGetDb(): Database | null {
  return _db;
}
