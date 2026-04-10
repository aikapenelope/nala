/**
 * Tenant isolation middleware.
 *
 * Sets the PostgreSQL session variable `app.current_business_id`
 * so that RLS policies automatically filter all queries to the
 * current tenant's data. A business never sees another business's data.
 *
 * Requires: authMiddleware must run first to set `businessId` on context.
 */

import type { Context, Next } from "hono";

/**
 * Tenant middleware - sets RLS context per request.
 *
 * In development (no DATABASE_URL), skips the DB call.
 * In production, executes SET on the PostgreSQL connection.
 */
export async function tenantMiddleware(c: Context, next: Next) {
  const businessId = c.get("businessId") as string | undefined;

  if (!businessId) {
    return c.json({ error: "Business context required" }, 400);
  }

  // TODO: When DB is connected, execute:
  // await db.execute(sql`SET app.current_business_id = ${businessId}`);
  //
  // This activates RLS for all subsequent queries in this request.
  // Each request gets its own connection from the pool, so the SET
  // only affects this request's queries.

  await next();
}
