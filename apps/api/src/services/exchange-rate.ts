/**
 * BCV exchange rate service.
 *
 * Rates are set manually by the business owner from the dashboard.
 * Supports USD and EUR (the two currencies used in Venezuelan commerce).
 *
 * Storage: exchange_rates table (history) + Redis cache (fast reads).
 * The `rate_bcv` column stores USD rate, `rate_parallel` stores EUR rate.
 *
 * No external API calls. The owner enters the rate they see on bcv.org.ve
 * or whatever source they trust. This is the pattern used by Aurora and
 * most Venezuelan commerce apps in 2026.
 */

import { desc } from "drizzle-orm";
import { exchangeRates } from "@nova/db";
import { getRedis } from "../redis";
import { tryGetDb } from "../db";

const REDIS_KEY = "nova:exchange_rate:current";

/** Exchange rate info returned to callers. */
export interface ExchangeRateInfo {
  /** Bs per 1 USD (BCV official rate). */
  rateBcv: number;
  /** Bs per 1 EUR (BCV official rate). Null if not set. */
  rateEur: number | null;
  date: string;
  updatedAt: string;
  source: "manual";
}

/**
 * Get the current exchange rate.
 *
 * Lookup order:
 * 1. Redis cache (fastest)
 * 2. Database exchange_rates table (latest entry)
 * 3. Error - no rate available
 */
export async function getCurrentRate(): Promise<ExchangeRateInfo> {
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
          rateEur: latest.rateParallel ? Number(latest.rateParallel) : null,
          date: latest.date.toISOString().split("T")[0],
          updatedAt: latest.createdAt.toISOString(),
          source: "manual",
        };

        if (redis) {
          try {
            await redis.set(REDIS_KEY, JSON.stringify(info), "EX", 300);
          } catch {
            // Non-critical
          }
        }

        return info;
      }
    } catch {
      // DB error
    }
  }

  throw new Error(
    "Tasa de cambio no configurada. Ve a Configuracion para establecer la tasa del dia.",
  );
}

/**
 * Set the current exchange rate (manual, by the business owner).
 *
 * Inserts a new row in exchange_rates (keeps history) and updates Redis cache.
 */
export async function setCurrentRate(
  rateBcv: number,
  rateEur?: number,
): Promise<ExchangeRateInfo> {
  if (rateBcv <= 0) {
    throw new Error("La tasa del dolar debe ser mayor a 0");
  }
  if (rateEur !== undefined && rateEur <= 0) {
    throw new Error("La tasa del euro debe ser mayor a 0");
  }

  const now = new Date();
  const info: ExchangeRateInfo = {
    rateBcv,
    rateEur: rateEur ?? null,
    date: now.toISOString().split("T")[0],
    updatedAt: now.toISOString(),
    source: "manual",
  };

  const db = tryGetDb();
  if (db) {
    await db.insert(exchangeRates).values({
      date: now,
      rateBcv: String(rateBcv),
      rateParallel: rateEur ? String(rateEur) : null,
    });
  }

  const redis = getRedis();
  if (redis) {
    await redis.set(REDIS_KEY, JSON.stringify(info), "EX", 86400);
  }

  return info;
}
