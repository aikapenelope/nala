/**
 * Shared accounting entry helpers.
 *
 * Eliminates duplication of the "find accounts 4101/1101 + insert entry"
 * pattern that was repeated in sales.ts, orders.ts, and order cancellation.
 */

import { eq, and } from "drizzle-orm";
import { accountingAccounts, accountingEntries } from "@nova/db";
import type { Database } from "@nova/db";

/** Transaction-compatible DB type (works with both db and tx). */
type TxOrDb = Parameters<Parameters<Database["transaction"]>[0]>[0] | Database;

/**
 * Create a revenue accounting entry (debit cash, credit revenue).
 *
 * Looks up accounts 1101 (cash) and 4101 (revenue) for the business.
 * If either account is missing, logs a warning and skips silently.
 *
 * @param tx - Transaction or database instance
 * @param businessId - Business UUID
 * @param amount - Amount as string (numeric)
 * @param description - Entry description
 * @param referenceType - Source type (e.g., "sale", "order_cancel")
 * @param referenceId - Source UUID
 */
export async function createRevenueEntry(
  tx: TxOrDb,
  businessId: string,
  amount: string,
  description: string,
  referenceType: string,
  referenceId: string,
): Promise<void> {
  const revenueAccounts = await tx
    .select()
    .from(accountingAccounts)
    .where(
      and(
        eq(accountingAccounts.businessId, businessId),
        eq(accountingAccounts.code, "4101"),
      ),
    )
    .limit(1);

  const cashAccounts = await tx
    .select()
    .from(accountingAccounts)
    .where(
      and(
        eq(accountingAccounts.businessId, businessId),
        eq(accountingAccounts.code, "1101"),
      ),
    )
    .limit(1);

  if (revenueAccounts[0] && cashAccounts[0]) {
    await tx.insert(accountingEntries).values({
      businessId,
      date: new Date(),
      debitAccountId: cashAccounts[0].id,
      creditAccountId: revenueAccounts[0].id,
      amount,
      description,
      referenceType,
      referenceId,
    });
  } else {
    console.warn(
      `[accounting] Entry skipped: missing accounts ` +
        `(4101: ${!!revenueAccounts[0]}, 1101: ${!!cashAccounts[0]}). ` +
        `Run onboarding to create default accounts.`,
    );
  }
}

/**
 * Create a reversal accounting entry (debit revenue, credit cash).
 *
 * Used when cancelling confirmed orders or voiding sales.
 * Swaps debit/credit compared to createRevenueEntry.
 */
export async function createReversalEntry(
  tx: TxOrDb,
  businessId: string,
  amount: string,
  description: string,
  referenceType: string,
  referenceId: string,
): Promise<void> {
  const revenueAccounts = await tx
    .select()
    .from(accountingAccounts)
    .where(
      and(
        eq(accountingAccounts.businessId, businessId),
        eq(accountingAccounts.code, "4101"),
      ),
    )
    .limit(1);

  const cashAccounts = await tx
    .select()
    .from(accountingAccounts)
    .where(
      and(
        eq(accountingAccounts.businessId, businessId),
        eq(accountingAccounts.code, "1101"),
      ),
    )
    .limit(1);

  if (revenueAccounts[0] && cashAccounts[0]) {
    // Reversal: debit revenue (reduce), credit cash (reduce)
    await tx.insert(accountingEntries).values({
      businessId,
      date: new Date(),
      debitAccountId: revenueAccounts[0].id,
      creditAccountId: cashAccounts[0].id,
      amount,
      description,
      referenceType,
      referenceId,
    });
  } else {
    console.warn(
      `[accounting] Reversal entry skipped: missing accounts ` +
        `(4101: ${!!revenueAccounts[0]}, 1101: ${!!cashAccounts[0]}). ` +
        `Run onboarding to create default accounts.`,
    );
  }
}
