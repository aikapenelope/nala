/**
 * Tenant isolation middleware placeholder.
 *
 * Phase 0: No-op (no database connection yet).
 * Phase 1: Will set PostgreSQL RLS context via:
 *   SET app.current_business_id = '{business_id}'
 *
 * This ensures every database query is automatically filtered
 * to the current tenant's data. A business never sees another
 * business's data.
 */

import type { Context, Next } from "hono";

/**
 * Tenant middleware - placeholder for Phase 0.
 * Will activate RLS per-request in Phase 1.
 */
export async function tenantMiddleware(c: Context, next: Next) {
  const businessId = c.get("businessId") as string | undefined;

  if (!businessId) {
    return c.json({ error: "Business context required" }, 400);
  }

  // Phase 1: Will execute:
  // await db.execute(sql`SET app.current_business_id = ${businessId}`);

  await next();
}
