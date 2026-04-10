/**
 * Database client setup using Drizzle ORM with postgres.js driver.
 *
 * Usage:
 *   import { db } from "@nova/db";
 *   const result = await db.select().from(businesses);
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Create a postgres.js connection and wrap it with Drizzle ORM.
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

  const client = postgres(url);
  return drizzle(client, { schema });
}

/** Type of the database instance for use in function signatures. */
export type Database = ReturnType<typeof createDb>;
