/**
 * Tenant isolation middleware.
 *
 * Sets the PostgreSQL session variable `app.current_business_id`
 * so that RLS policies automatically filter all queries to the
 * current tenant's data. A business never sees another business's data.
 *
 * Requires: authMiddleware must run first to set `businessId` and `db`
 * on the Hono context.
 *
 * Safety model:
 * - Sets the RLS variable at the START of every request.
 * - Clears it at the END of every request (even on error).
 * - This prevents a stale business_id from leaking to the next request
 *   that reuses the same pooled connection.
 *
 * For critical write operations (sales, payments), route handlers should
 * additionally wrap their queries in `db.transaction()` for atomicity.
 */

import { sql } from "drizzle-orm";
import type { Context, Next } from "hono";
import type { Database } from "@nova/db";

/**
 * Tenant middleware - sets RLS context per request and clears it after.
 *
 * Reads the `db` instance from context (set by authMiddleware)
 * and executes SET on the PostgreSQL connection.
 */
export async function tenantMiddleware(c: Context, next: Next) {
  const businessId = c.get("businessId") as string | undefined;

  if (!businessId) {
    return c.json({ error: "Business context required" }, 400);
  }

  const db = c.get("db") as Database;

  // Set the RLS variable for this connection.
  // This activates row-level security policies defined in init.sql.
  await db.execute(
    sql`SELECT set_config('app.current_business_id', ${businessId}, false)`,
  );

  try {
    await next();
  } finally {
    // Clear the RLS variable so the pooled connection doesn't carry
    // a stale tenant context to the next request.
    await db.execute(
      sql`SELECT set_config('app.current_business_id', '', false)`,
    ).catch(() => {
      // Non-critical: if the connection is already broken, clearing fails
      // harmlessly. The next request will set its own context anyway.
    });
  }
}
