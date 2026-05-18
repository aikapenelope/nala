/**
 * Database client setup using Drizzle ORM with postgres.js driver.
 *
 * Pool configuration:
 * - max: 20 connections (supports ~100 concurrent requests)
 * - idle_timeout: 30s (release idle connections back to OS)
 * - connect_timeout: 10s (fail fast if DB is unreachable)
 *
 * postgres.js uses a connection pool internally. Each query acquires
 * a connection, executes, and returns it to the pool. The pool grows
 * on demand up to `max` and shrinks after `idle_timeout`.
 *
 * Usage:
 *   import { db } from "@nova/db";
 *   const result = await db.select().from(businesses);
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Create a postgres.js connection pool and wrap it with Drizzle ORM.
 * The DATABASE_URL environment variable must be set.
 */
export function createDb(connectionString?: string) {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
        "Set it in your .env file or pass it directly.",
    );
  }

  const client = postgres(url, {
    // Pool size: 20 connections handles ~100 concurrent requests.
    // Default is 10, which saturates at ~50 concurrent requests.
    max: 20,
    // Release idle connections after 30 seconds to free OS resources.
    idle_timeout: 30,
    // Fail fast if the database is unreachable (don't hang indefinitely).
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

/** Type of the database instance for use in function signatures. */
export type Database = ReturnType<typeof createDb>;
