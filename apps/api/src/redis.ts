/**
 * Redis singleton for the API server.
 *
 * Used for exchange rate caching and session data.
 * Falls back gracefully when REDIS_URL is not set (dev mode).
 */

import Redis from "ioredis";
import { logger } from "./logger";

let _redis: Redis | null = null;

/**
 * Initialize the Redis connection.
 * Returns null if REDIS_URL is not configured (dev fallback).
 *
 * Connects eagerly so failures surface at startup rather than
 * on the first request.
 */
export function initRedis(): Redis | null {
  if (_redis) return _redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn("redis", "REDIS_URL not set, features disabled");
    return null;
  }

  _redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      // Exponential backoff capped at 3 seconds
      return Math.min(times * 200, 3000);
    },
  });

  _redis.on("error", (err) => {
    logger.error("redis", "Connection error", { error: err.message });
  });

  return _redis;
}

/**
 * Get the Redis instance, or null if not configured.
 */
export function getRedis(): Redis | null {
  return _redis;
}

/**
 * Close the Redis connection gracefully.
 * Called during shutdown to release resources.
 */
export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}
