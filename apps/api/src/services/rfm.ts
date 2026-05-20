/**
 * RFM (Recency, Frequency, Monetary) scoring service.
 *
 * Calculates RFM scores for customers using adaptive quintiles
 * calibrated per-business. A bakery with 20 customers has different
 * thresholds than a clothing store with 500.
 *
 * Scoring window: 90 days (configurable via RFM_WINDOW_DAYS).
 * Quintile method: percentile-based (P20/P40/P60/P80) per business.
 *
 * Usage:
 *   - recalculateBusinessRfm(db, businessId): recalculate all customers
 *   - recalculateSingleCustomerRfm(db, businessId, customerId): after a sale
 */

import { eq, and, sql, gte } from "drizzle-orm";
import { customers, sales } from "@nova/db";
import type { Database } from "@nova/db";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Number of days to look back for frequency and monetary calculations. */
const RFM_WINDOW_DAYS = 90;

/** Minimum customers required to calculate meaningful quintiles. */
const MIN_CUSTOMERS_FOR_QUINTILES = 5;

// ---------------------------------------------------------------------------
// RFM Segment Definitions
// ---------------------------------------------------------------------------

export type RfmSegment =
  | "champion"
  | "loyal"
  | "potential_loyal"
  | "new"
  | "promising"
  | "needs_attention"
  | "about_to_sleep"
  | "at_risk"
  | "hibernating"
  | "lost";

/** Spanish labels for each segment (used in the frontend). */
export const RFM_SEGMENT_LABELS: Record<RfmSegment, string> = {
  champion: "Campeón",
  loyal: "Leal",
  potential_loyal: "Potencial leal",
  new: "Nuevo",
  promising: "Prometedor",
  needs_attention: "Necesita atención",
  about_to_sleep: "Por dormirse",
  at_risk: "En riesgo",
  hibernating: "Hibernando",
  lost: "Perdido",
};

// ---------------------------------------------------------------------------
// Quintile Calculation
// ---------------------------------------------------------------------------

/**
 * Assign a quintile score (1-5) based on percentile position in a sorted array.
 * For recency, lower values are better (score 5 = most recent).
 * For frequency and monetary, higher values are better (score 5 = most frequent/valuable).
 */
function assignQuintile(
  value: number,
  sortedValues: number[],
  invertForRecency: boolean,
): number {
  if (sortedValues.length < MIN_CUSTOMERS_FOR_QUINTILES) {
    // Not enough data for meaningful quintiles — use simple thresholds
    if (invertForRecency) {
      // Recency: fewer days = better
      if (value <= 7) return 5;
      if (value <= 14) return 4;
      if (value <= 30) return 3;
      if (value <= 60) return 2;
      return 1;
    }
    // Frequency/Monetary: more = better
    if (value <= 0) return 1;
    if (sortedValues.length <= 1) return 3;
    const max = sortedValues[sortedValues.length - 1];
    const ratio = max > 0 ? value / max : 0;
    if (ratio >= 0.8) return 5;
    if (ratio >= 0.6) return 4;
    if (ratio >= 0.4) return 3;
    if (ratio >= 0.2) return 2;
    return 1;
  }

  // Calculate percentile position
  const n = sortedValues.length;
  const p20 = sortedValues[Math.floor(n * 0.2)];
  const p40 = sortedValues[Math.floor(n * 0.4)];
  const p60 = sortedValues[Math.floor(n * 0.6)];
  const p80 = sortedValues[Math.floor(n * 0.8)];

  if (invertForRecency) {
    // Recency: lower value = higher score
    if (value <= p20) return 5;
    if (value <= p40) return 4;
    if (value <= p60) return 3;
    if (value <= p80) return 2;
    return 1;
  }

  // Frequency/Monetary: higher value = higher score
  if (value >= p80) return 5;
  if (value >= p60) return 4;
  if (value >= p40) return 3;
  if (value >= p20) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Segment Derivation
// ---------------------------------------------------------------------------

/**
 * Derive the RFM segment from the R, F, M scores (each 1-5).
 *
 * Based on standard RFM segmentation matrix adapted for small businesses.
 * Priority order matters: first match wins.
 */
function deriveSegment(r: number, f: number, m: number): RfmSegment {
  // Champions: recent, frequent, high value
  if (r >= 4 && f >= 4 && m >= 4) return "champion";

  // Loyal: frequent buyers with good value (may not be super recent)
  if (f >= 4 && m >= 3) return "loyal";

  // At risk: were valuable but haven't bought recently
  if (r <= 2 && f >= 3 && m >= 3) return "at_risk";

  // Potential loyal: recent but not yet frequent
  if (r >= 4 && f >= 2 && f <= 3) return "potential_loyal";

  // New: very recent, first purchase(s)
  if (r >= 4 && f === 1) return "new";

  // Needs attention: mid-range across the board, slipping
  if (r === 3 && f >= 3) return "needs_attention";

  // Promising: somewhat recent, low frequency
  if (r >= 3 && f <= 2 && m <= 3) return "promising";

  // About to sleep: low recency, some history
  if (r === 2 && f >= 2) return "about_to_sleep";

  // Hibernating: very low recency, some past activity
  if (r === 1 && (f >= 2 || m >= 2)) return "hibernating";

  // Lost: lowest scores across the board
  return "lost";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface RfmRawData {
  customerId: string;
  recencyDays: number;
  frequency: number;
  monetary: number;
}

/**
 * Recalculate RFM scores for ALL customers of a business.
 *
 * Steps:
 * 1. Query raw R, F, M values for all customers with at least 1 purchase
 * 2. Build sorted arrays for quintile calculation
 * 3. Assign scores and derive segments
 * 4. Batch-update the customers table
 *
 * Safe to call on every dashboard load (idempotent, ~50-100ms for 200 customers).
 */
export async function recalculateBusinessRfm(
  db: Database,
  businessId: string,
): Promise<{ updated: number }> {
  const windowStart = new Date(
    Date.now() - RFM_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  // Query raw RFM data: for each customer, get days since last purchase,
  // number of purchases in window, and total spent in window.
  const rawData = await db
    .select({
      customerId: customers.id,
      lastPurchaseAt: customers.lastPurchaseAt,
      totalPurchases: customers.totalPurchases,
      totalSpentUsd: customers.totalSpentUsd,
    })
    .from(customers)
    .where(
      and(
        eq(customers.businessId, businessId),
        eq(customers.isActive, true),
        sql`${customers.totalPurchases} > 0`,
      ),
    );

  if (rawData.length === 0) {
    return { updated: 0 };
  }

  // Get frequency within the window (purchases in last 90 days per customer)
  const frequencyData = await db
    .select({
      customerId: sales.customerId,
      windowPurchases: sql<number>`count(*)::int`,
      windowSpent: sql<string>`COALESCE(sum(${sales.totalUsd}::numeric), 0)`,
    })
    .from(sales)
    .where(
      and(
        eq(sales.businessId, businessId),
        eq(sales.status, "completed"),
        sql`${sales.customerId} IS NOT NULL`,
        gte(sales.createdAt, windowStart),
      ),
    )
    .groupBy(sales.customerId);

  const freqMap = new Map(
    frequencyData.map((d) => [
      d.customerId,
      { frequency: d.windowPurchases, monetary: Number(d.windowSpent) },
    ]),
  );

  // Calculate raw values for each customer
  const now = Date.now();
  const rfmValues: RfmRawData[] = rawData.map((c) => {
    const recencyDays = c.lastPurchaseAt
      ? Math.floor((now - c.lastPurchaseAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999; // Never purchased = max recency

    const windowData = freqMap.get(c.customerId);
    return {
      customerId: c.customerId,
      recencyDays,
      frequency: windowData?.frequency ?? 0,
      monetary: windowData?.monetary ?? 0,
    };
  });

  // Build sorted arrays for quintile boundaries
  const sortedRecency = rfmValues
    .map((v) => v.recencyDays)
    .sort((a, b) => a - b);
  const sortedFrequency = rfmValues
    .map((v) => v.frequency)
    .sort((a, b) => a - b);
  const sortedMonetary = rfmValues
    .map((v) => v.monetary)
    .sort((a, b) => a - b);

  // Calculate scores and update each customer
  const calculatedAt = new Date();
  let updated = 0;

  for (const data of rfmValues) {
    const r = assignQuintile(data.recencyDays, sortedRecency, true);
    const f = assignQuintile(data.frequency, sortedFrequency, false);
    const m = assignQuintile(data.monetary, sortedMonetary, false);
    const score = `${r}${f}${m}`;
    const segment = deriveSegment(r, f, m);

    await db
      .update(customers)
      .set({
        rfmRecency: data.recencyDays,
        rfmFrequency: data.frequency,
        rfmMonetary: String(data.monetary),
        rfmScore: score,
        rfmSegment: segment,
        rfmCalculatedAt: calculatedAt,
      })
      .where(eq(customers.id, data.customerId));

    updated++;
  }

  logger.info("rfm", "Business RFM recalculated", {
    businessId,
    customersScored: updated,
  });

  return { updated };
}

/**
 * Recalculate RFM for a single customer after a sale.
 *
 * Uses the existing quintile boundaries from the business (reads other
 * customers' scores to determine relative position). This is O(1) for
 * the update but O(N) for reading boundaries — acceptable for <1000 customers.
 *
 * If the business has fewer than MIN_CUSTOMERS_FOR_QUINTILES customers,
 * uses simple absolute thresholds instead.
 */
export async function recalculateSingleCustomerRfm(
  db: Database,
  businessId: string,
  customerId: string,
): Promise<void> {
  const windowStart = new Date(
    Date.now() - RFM_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  // Get this customer's data
  const [customer] = await db
    .select({
      lastPurchaseAt: customers.lastPurchaseAt,
    })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!customer) return;

  // Get this customer's window stats
  const [windowStats] = await db
    .select({
      frequency: sql<number>`count(*)::int`,
      monetary: sql<string>`COALESCE(sum(${sales.totalUsd}::numeric), 0)`,
    })
    .from(sales)
    .where(
      and(
        eq(sales.customerId, customerId),
        eq(sales.businessId, businessId),
        eq(sales.status, "completed"),
        gte(sales.createdAt, windowStart),
      ),
    );

  const now = Date.now();
  const recencyDays = customer.lastPurchaseAt
    ? Math.floor(
        (now - customer.lastPurchaseAt.getTime()) / (1000 * 60 * 60 * 24),
      )
    : 999;
  const frequency = windowStats?.frequency ?? 0;
  const monetary = Number(windowStats?.monetary ?? "0");

  // Get all customers' RFM raw values for quintile boundaries
  const allCustomers = await db
    .select({
      rfmRecency: customers.rfmRecency,
      rfmFrequency: customers.rfmFrequency,
      rfmMonetary: customers.rfmMonetary,
    })
    .from(customers)
    .where(
      and(
        eq(customers.businessId, businessId),
        eq(customers.isActive, true),
        sql`${customers.rfmRecency} IS NOT NULL`,
      ),
    );

  const sortedRecency = allCustomers
    .map((c) => c.rfmRecency!)
    .sort((a, b) => a - b);
  const sortedFrequency = allCustomers
    .map((c) => c.rfmFrequency!)
    .sort((a, b) => a - b);
  const sortedMonetary = allCustomers
    .map((c) => Number(c.rfmMonetary ?? 0))
    .sort((a, b) => a - b);

  const r = assignQuintile(recencyDays, sortedRecency, true);
  const f = assignQuintile(frequency, sortedFrequency, false);
  const m = assignQuintile(monetary, sortedMonetary, false);
  const score = `${r}${f}${m}`;
  const segment = deriveSegment(r, f, m);

  await db
    .update(customers)
    .set({
      rfmRecency: recencyDays,
      rfmFrequency: frequency,
      rfmMonetary: String(monetary),
      rfmScore: score,
      rfmSegment: segment,
      rfmCalculatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));
}
