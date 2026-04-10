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
 * Note on set_config's third parameter (is_local):
 * - `true` means the setting only lasts for the current transaction.
 *   Since postgres.js uses a connection pool, using `true` would require
 *   wrapping every request in a transaction.
 * - `false` means the setting persists for the session (connection).
 *   With postgres.js, each query may use a different connection from the
 *   pool, so we set it before each request's queries. This is safe because
 *   the middleware runs at the start of every request.
 *
 * For true per-request isolation with connection pooling, each route
 * handler should wrap its queries in a transaction when RLS is critical.
 */

import { sql } from "drizzle-orm";
import type { Context, Next } from "hono";
import type { Database } from "@nova/db";

/**
 * Tenant middleware - sets RLS context per request.
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

  await next();
}
