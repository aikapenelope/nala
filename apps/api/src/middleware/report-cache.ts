/**
 * Redis cache middleware for report endpoints.
 *
 * Caches JSON responses per business + endpoint + query params.
 * TTL is 60 seconds — short enough to reflect recent sales,
 * long enough to prevent repeated heavy queries when the
 * dashboard reloads or the user refreshes.
 *
 * Cache is bypassed when:
 * - Redis is not available (graceful degradation)
 * - The request includes `Cache-Control: no-cache` header
 *
 * Cache keys follow: `report:{businessId}:{path}:{sortedQueryString}`
 */

import { createMiddleware } from "hono/factory";
import { getRedis } from "../redis";

/** Default TTL for report cache entries (seconds). */
const REPORT_CACHE_TTL = 60;

/**
 * Report cache middleware.
 *
 * Must be placed AFTER auth/tenant middleware (needs businessId).
 * Intercepts the response, caches it, and serves from cache on subsequent hits.
 */
export const reportCache = createMiddleware(async (c, next) => {
  const redis = getRedis();
  if (!redis) {
    // No Redis — skip caching, execute handler directly
    await next();
    return;
  }

  // Allow clients to bypass cache explicitly
  if (c.req.header("Cache-Control") === "no-cache") {
    await next();
    return;
  }

  const businessId = c.get("businessId") as string | undefined;
  if (!businessId) {
    await next();
    return;
  }

  // Build a deterministic cache key from path + sorted query params
  const path = c.req.path;
  const url = new URL(c.req.url);
  const params = [...url.searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const cacheKey = `report:${businessId}:${path}:${params}`;

  // Try cache hit
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      c.header("X-Cache", "HIT");
      c.header("Content-Type", "application/json");
      return c.body(cached);
    }
  } catch {
    // Redis read error — proceed without cache
  }

  // Cache miss — execute handler
  await next();

  // Only cache successful JSON responses
  if (c.res.status === 200 && c.res.headers.get("Content-Type")?.includes("application/json")) {
    try {
      // Clone the response to read the body without consuming it
      const body = await c.res.clone().text();
      // Fire-and-forget: don't block the response on cache write
      redis.set(cacheKey, body, "EX", REPORT_CACHE_TTL).catch(() => {
        // Non-critical: cache write failure is harmless
      });
      c.header("X-Cache", "MISS");
    } catch {
      // Non-critical: if we can't read the body, skip caching
    }
  }
});
