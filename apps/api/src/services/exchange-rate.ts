/**
 * BCV exchange rate service.
 *
 * Reads the current exchange rate from Redis cache or the database.
 * The rate is populated externally (cron job, admin UI, or manual update).
 *
 * This service does NOT fetch rates from external APIs. BCV has no official
 * API, and community scrapers are unreliable (Cloudflare blocks, rate limits).
 * Instead, the rate is set via:
 * 1. POST /api/exchange-rate (admin endpoint, future sprint)
 * 2. Redis cache key "nova:exchange_rate:current"
 * 3. exchange_rates DB table
 *
 * If no rate is available, the service throws an error. This prevents
 * sales from being recorded with incorrect Bs amounts.
 */

import { desc } from "drizzle-orm";
import { exchangeRates } from "@nova/db";
import { getRedis } from "../redis";
import { tryGetDb } from "../db";

const REDIS_KEY = "nova:exchange_rate:current";

/** Exchange rate info returned to callers. */
export interface ExchangeRateInfo {
  rateBcv: number;
  rateParallel: number | null;
  date: string;
  updatedAt: string;
}

/**
 * Get the current exchange rate.
 *
 * Lookup order:
 * 1. Redis cache (fastest, set by cron or admin)
 * 2. Database exchange_rates table (latest entry)
 * 3. Error - no rate available
 *
 * Throws if no rate is found anywhere. Callers should handle this
 * and return an appropriate error to the client.
 */
export async function getCurrentRate(): Promise<ExchangeRateInfo> {
  // 1. Try Redis cache
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(REDIS_KEY);
      if (cached) {
        return JSON.parse(cached) as ExchangeRateInfo;
      }
    } catch {
      // Redis error - fall through to DB
    }
  }

  // 2. Try database (latest exchange rate entry)
  const db = tryGetDb();
  if (db) {
    try {
      const [latest] = await db
        .select()
        .from(exchangeRates)
        .orderBy(desc(exchangeRates.date))
        .limit(1);

      if (latest) {
        const info: ExchangeRateInfo = {
          rateBcv: Number(latest.rateBcv),
          rateParallel: latest.rateParallel
            ? Number(latest.rateParallel)
            : null,
          date: latest.date.toISOString().split("T")[0],
          updatedAt: latest.createdAt.toISOString(),
        };

        // Populate Redis cache for next request (5 min TTL as bridge)
        if (redis) {
          try {
            await redis.set(REDIS_KEY, JSON.stringify(info), "EX", 300);
          } catch {
            // Non-critical cache write failure
          }
        }

        return info;
      }
    } catch {
      // DB error - fall through to error
    }
  }

  // 3. No rate available anywhere
  throw new Error(
    "Exchange rate not available. Set the rate via the admin endpoint " +
      "or insert a row into the exchange_rates table.",
  );
}

/**
 * Set the current exchange rate in Redis cache and DB.
 *
 * Used by admin endpoints and cron jobs to update the rate.
 * Stores in both Redis (for fast reads) and DB (for persistence/history).
 */
export async function setCurrentRate(
  rateBcv: number,
  rateParallel?: number,
): Promise<ExchangeRateInfo> {
  if (rateBcv <= 0) {
    throw new Error("Exchange rate must be positive");
  }

  const now = new Date();
  const info: ExchangeRateInfo = {
    rateBcv,
    rateParallel: rateParallel ?? null,
    date: now.toISOString().split("T")[0],
    updatedAt: now.toISOString(),
  };

  // Store in DB for persistence
  const db = tryGetDb();
  if (db) {
    await db.insert(exchangeRates).values({
      date: now,
      rateBcv: String(rateBcv),
      rateParallel: rateParallel ? String(rateParallel) : null,
    });
  }

  // Store in Redis for fast reads (24h TTL)
  const redis = getRedis();
  if (redis) {
    await redis.set(REDIS_KEY, JSON.stringify(info), "EX", 86400);
  }

  return info;
}
