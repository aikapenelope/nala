/**
 * Gamification utilities - seller rankings, goals, streaks.
 */

import { z } from "zod";

/** Daily goal for a seller. */
export const dailyGoalSchema = z.object({
  targetUsd: z.number().min(0),
});

/** Seller ranking entry. */
export interface SellerRanking {
  userId: string;
  name: string;
  salesCount: number;
  totalUsd: number;
  avgTicket: number;
  rank: number;
}

/** Seller streak info. */
export interface SellerStreak {
  userId: string;
  currentStreak: number;
  bestStreak: number;
  metGoalToday: boolean;
}

/** Calculate goal progress as percentage (0-100). */
export function goalProgress(currentUsd: number, targetUsd: number): number {
  if (targetUsd <= 0) return 100;
  return Math.min(100, Math.round((currentUsd / targetUsd) * 100));
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
