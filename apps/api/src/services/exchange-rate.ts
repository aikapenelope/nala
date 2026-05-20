/**
 * BCV exchange rate service (per-tenant).
 *
 * Rates are set manually by each business owner from the dashboard.
 * Supports USD and EUR (the two currencies used in Venezuelan commerce).
 *
 * Storage: exchange_rates table (history, per business) + Redis cache (fast reads, per tenant).
 *
 * No external API calls. The owner enters the rate they see on bcv.org.ve
 * or whatever source they trust.
 */

import { desc, eq, sql } from "drizzle-orm";
import { exchangeRates } from "@nova/db";
import { getRedis } from "../redis";
import { tryGetDb } from "../db";
import { logger } from "../logger";
import { redisOperationsTotal } from "../metrics";

/** Redis key scoped to a specific business. */
function redisKey(businessId: string): string {
  return `nova:${businessId}:exchange_rate:current`;
}

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
 * Get the current exchange rate for a specific business.
 *
 * Lookup order:
 * 1. Redis cache (fastest, scoped to businessId)
 * 2. Database exchange_rates table (latest entry for this business)
 * 3. Error - no rate available
 */
export async function getCurrentRate(
  businessId: string,
): Promise<ExchangeRateInfo> {
  const redis = getRedis();
  const key = redisKey(businessId);

  if (redis) {
    try {
      const cached = await redis.get(key);
      redisOperationsTotal.inc({ operation: "get", status: "ok" });
      if (cached) {
        return JSON.parse(cached) as ExchangeRateInfo;
      }
    } catch (err) {
      redisOperationsTotal.inc({ operation: "get", status: "error" });
      logger.debug("exchange-rate", "Redis read failed, falling through to DB", {
        businessId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const db = tryGetDb();
  if (db) {
    try {
      const [latest] = await db
        .select()
        .from(exchangeRates)
        .where(eq(exchangeRates.businessId, businessId))
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
            await redis.set(key, JSON.stringify(info), "EX", 300);
            redisOperationsTotal.inc({ operation: "set", status: "ok" });
          } catch (err) {
            redisOperationsTotal.inc({ operation: "set", status: "error" });
            logger.debug("exchange-rate", "Redis cache write failed", {
              businessId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        return info;
      }
    } catch (err) {
      logger.debug("exchange-rate", "DB read failed", {
        businessId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  throw new Error(
    "Tasa de cambio no configurada. Ve a Configuracion para establecer la tasa del dia.",
  );
}

/**
 * Set the current exchange rate for a specific business (manual, by the owner).
 *
 * Inserts a new row in exchange_rates (keeps history) and updates Redis cache.
 */
export async function setCurrentRate(
  businessId: string,
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
    // UPSERT: if a rate already exists for this business+day, update it.
    // The unique index idx_exchange_rates_business_day enforces one rate per day.
    await db.insert(exchangeRates).values({
      businessId,
      date: now,
      rateBcv: String(rateBcv),
      rateParallel: rateEur ? String(rateEur) : null,
    }).onConflictDoUpdate({
      target: [exchangeRates.businessId, exchangeRates.date],
      set: {
        rateBcv: sql`EXCLUDED.rate_bcv`,
        rateParallel: sql`EXCLUDED.rate_parallel`,
      },
      where: sql`DATE(${exchangeRates.date}) = DATE(EXCLUDED.date)`,
    });
  }

  const redis = getRedis();
  if (redis) {
    await redis.set(redisKey(businessId), JSON.stringify(info), "EX", 86400);
  }

  return info;
}
