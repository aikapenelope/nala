/**
 * Redis singleton for the API server.
 *
 * Used for exchange rate caching and session data.
 * Falls back gracefully when REDIS_URL is not set (dev mode).
 */

import Redis from "ioredis";

let _redis: Redis | null = null;

/**
 * Initialize the Redis connection.
 * Returns null if REDIS_URL is not configured (dev fallback).
 */
export function initRedis(): Redis | null {
  if (_redis) return _redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("REDIS_URL not set. Redis features disabled.");
    return null;
  }

  _redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  _redis.on("error", (err) => {
    console.error("Redis connection error:", err.message);
  });

  return _redis;
}

/**
 * Get the Redis instance, or null if not configured.
 */
export function getRedis(): Redis | null {
  return _redis;
}
