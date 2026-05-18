/**
 * Shared customer purchase statistics helpers.
 *
 * Eliminates duplication of the customer stats update pattern
 * that was repeated in sales.ts (create + void) and orders.ts (confirm).
 */

import { eq, sql } from "drizzle-orm";
import { customers } from "@nova/db";
import type { Database } from "@nova/db";

/** Transaction-compatible DB type (works with both db and tx). */
type TxOrDb = Parameters<Parameters<Database["transaction"]>[0]>[0] | Database;

/**
 * Increment customer purchase statistics after a sale.
 *
 * Updates: totalPurchases, totalSpentUsd, averageTicketUsd, lastPurchaseAt.
 *
 * @param tx - Transaction or database instance
 * @param customerId - Customer UUID
 * @param saleTotal - Sale total in USD (number)
 */
export async function incrementCustomerStats(
  tx: TxOrDb,
  customerId: string,
  saleTotal: number,
): Promise<void> {
  await tx
    .update(customers)
    .set({
      totalPurchases: sql`${customers.totalPurchases} + 1`,
      totalSpentUsd: sql`${customers.totalSpentUsd}::numeric + ${saleTotal}`,
      averageTicketUsd: sql`(${customers.totalSpentUsd}::numeric + ${saleTotal}) / (${customers.totalPurchases} + 1)`,
      lastPurchaseAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));
}

/**
 * Decrement customer purchase statistics when voiding a sale.
 *
 * Uses GREATEST to prevent negative values.
 * Optionally also reverses fiado balance in the same atomic UPDATE.
 *
 * @param tx - Transaction or database instance
 * @param customerId - Customer UUID
 * @param saleTotal - Original sale total in USD (number)
 * @param fiadoTotal - Fiado amount to reverse (0 if no fiado)
 */
export async function decrementCustomerStats(
  tx: TxOrDb,
  customerId: string,
  saleTotal: number,
  fiadoTotal: number = 0,
): Promise<void> {
  await tx
    .update(customers)
    .set({
      balanceUsd: fiadoTotal > 0
        ? sql`GREATEST(${customers.balanceUsd}::numeric - ${fiadoTotal}, 0)`
        : customers.balanceUsd,
      totalPurchases: sql`GREATEST(${customers.totalPurchases} - 1, 0)`,
      totalSpentUsd: sql`GREATEST(${customers.totalSpentUsd}::numeric - ${saleTotal}, 0)`,
      averageTicketUsd: sql`CASE WHEN ${customers.totalPurchases} > 1
        THEN (${customers.totalSpentUsd}::numeric - ${saleTotal}) / (${customers.totalPurchases} - 1)
        ELSE 0 END`,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));
}
