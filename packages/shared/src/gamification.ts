/**
 * Seller ranking utility.
 *
 * Used by the /reports/sellers endpoint to rank sellers by total sales.
 */

/** Seller ranking entry. */
export interface SellerRanking {
  userId: string;
  name: string;
  salesCount: number;
  totalUsd: number;
  avgTicket: number;
  rank: number;
}

/**
 * Sort sellers into a ranked list by total sales.
 * Assigns rank 1, 2, 3... based on totalUsd descending.
 */
export function rankSellers(
  sellers: Array<{ userId: string; name: string; salesCount: number; totalUsd: number }>,
): SellerRanking[] {
  return [...sellers]
    .sort((a, b) => b.totalUsd - a.totalUsd)
    .map((s, i) => ({
      ...s,
      avgTicket: s.salesCount > 0 ? Math.round((s.totalUsd / s.salesCount) * 100) / 100 : 0,
      rank: i + 1,
    }));
}
