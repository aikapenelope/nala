/**
 * BCV exchange rate service.
 *
 * Fetches the official BCV (Banco Central de Venezuela) rate daily.
 * Caches in Redis for fast access throughout the day.
 *
 * In production: cron job calls fetchBcvRate() once per day.
 * Each API request reads from cache via getCurrentRate().
 */

/** Cached rate structure. */
export interface ExchangeRateInfo {
  rateBcv: number;
  rateParallel: number | null;
  date: string;
  updatedAt: string;
}

/**
 * Fetch the current BCV rate.
 *
 * Strategy:
 * 1. Check Redis cache first
 * 2. If cache miss or stale, fetch from BCV API
 * 3. Store in Redis with 24h TTL
 * 4. Persist to exchange_rates table for history
 *
 * BCV publishes rates at https://www.bcv.org.ve
 * We scrape the rate from their page since there's no official API.
 */
export async function fetchBcvRate(): Promise<number> {
  // TODO: Implement BCV scraper when deploying to production
  // Options:
  // 1. Scrape bcv.org.ve directly (fragile, may break)
  // 2. Use a third-party API like exchangerate-api.com
  // 3. Use pydolarvenezuela API (community maintained)
  //
  // For now, return a placeholder rate
  return 36.5;
}

/**
 * Get the current exchange rate from cache.
 *
 * Returns the cached rate or fetches a fresh one if cache is empty.
 * In production, this reads from Redis. In dev, returns placeholder.
 */
export async function getCurrentRate(): Promise<ExchangeRateInfo> {
  // TODO: Read from Redis cache
  // const cached = await redis.get("nova:exchange_rate:current");
  // if (cached) return JSON.parse(cached);

  const rate = await fetchBcvRate();

  return {
    rateBcv: rate,
    rateParallel: null,
    date: new Date().toISOString().split("T")[0],
    updatedAt: new Date().toISOString(),
  };
}
