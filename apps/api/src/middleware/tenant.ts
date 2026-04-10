/**
 * Tenant isolation middleware.
 *
 * Sets the PostgreSQL session variable `app.current_business_id`
 * so that RLS policies automatically filter all queries to the
 * current tenant's data. A business never sees another business's data.
 *
 * Requires: authMiddleware must run first to set `businessId` on context.
 */

import { sql } from "drizzle-orm";
import type { Context, Next } from "hono";
import { getDb } from "../db";

/**
 * Tenant middleware - sets RLS context per request.
 *
 * Executes SET on the PostgreSQL connection so all subsequent
 * queries in this request are scoped to the current business.
 */
export async function tenantMiddleware(c: Context, next: Next) {
  const businessId = c.get("businessId") as string | undefined;

  if (!businessId) {
    return c.json({ error: "Business context required" }, 400);
  }

  const db = getDb();

  // Set the RLS variable for this request's queries.
  // This activates row-level security policies defined in init.sql.
  await db.execute(
    sql`SELECT set_config('app.current_business_id', ${businessId}, false)`,
  );

  await next();
}
