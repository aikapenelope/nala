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
 * - RESETS the RLS variable to empty at the START (defense against stale state).
 * - Sets the correct businessId immediately after.
 * - Clears it at the END of every request (even on error).
 * - Double-defense: even if the cleanup fails (broken connection), the next
 *   request on that pooled connection will reset-then-set, preventing leaks.
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
 * Uses a defensive reset-then-set pattern:
 * 1. Clear any stale context from a previous request (defense-in-depth)
 * 2. Set the current tenant's businessId
 * 3. After the request completes, clear the context
 *
 * This ensures that even if step 3 fails on a previous request (e.g.,
 * connection timeout), step 1 on the next request prevents data leakage.
 */
export async function tenantMiddleware(c: Context, next: Next) {
  const businessId = c.get("businessId") as string | undefined;

  if (!businessId) {
    return c.json({ error: "Business context required" }, 400);
  }

  const db = c.get("db") as Database;

  // Defense-in-depth: clear any stale context from a previous request
  // that may have failed to clean up (e.g., connection timeout, crash).
  // Then immediately set the correct context for this request.
  // Both operations use session-level scope (false) because individual
  // queries outside transactions need the context to persist.
  await db.execute(
    sql`SELECT set_config('app.current_business_id', '', false)`,
  );
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
      // harmlessly. The next request will reset-then-set anyway (step 1).
    });
  }
}
