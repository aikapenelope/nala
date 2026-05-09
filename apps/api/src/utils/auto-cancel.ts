/**
 * Auto-cancel stale pending orders.
 *
 * Orders that remain in "pending" status for more than 24 hours
 * are automatically cancelled. This prevents inventory contamination
 * where customers create orders but never pay.
 *
 * Can be triggered by:
 * - A cron job hitting POST /api/orders/auto-cancel
 * - A periodic check on the orders list page
 */

import { lt, eq, and } from "drizzle-orm";
import { orders } from "@nova/db";
import type { Database } from "@nova/db";

/** How long a pending order can exist before auto-cancellation (24 hours). */
const STALE_THRESHOLD_HOURS = 24;

/**
 * Cancel all pending orders older than the threshold.
 *
 * @param db - Database instance
 * @returns Number of orders cancelled
 */
export async function cancelStaleOrders(db: Database): Promise<number> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - STALE_THRESHOLD_HOURS);

  const result = await db
    .update(orders)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: "Auto-cancelado: sin confirmacion en 24 horas",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.status, "pending"),
        lt(orders.createdAt, cutoff),
      ),
    )
    .returning({ id: orders.id });

  return result.length;
}

/**
 * Cancel stale orders for a specific business.
 *
 * @param db - Database instance
 * @param businessId - Business UUID
 * @returns Number of orders cancelled
 */
export async function cancelStaleOrdersForBusiness(
  db: Database,
  businessId: string,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - STALE_THRESHOLD_HOURS);

  const result = await db
    .update(orders)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: "Auto-cancelado: sin confirmacion en 24 horas",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.businessId, businessId),
        eq(orders.status, "pending"),
        lt(orders.createdAt, cutoff),
      ),
    )
    .returning({ id: orders.id });

  return result.length;
}
