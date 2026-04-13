/**
 * Rate limiting middleware using Redis sliding window.
 *
 * Limits requests per IP (public endpoints) or per user (authenticated).
 * Falls back to in-memory Map when Redis is not available (dev mode).
 *
 * Thresholds:
 * - Public endpoints: 60 req/min per IP
 * - Authenticated endpoints: 120 req/min per user
 * - Write endpoints (POST/PUT/PATCH/DELETE): 30 req/min per user
 */

import type { Context, Next } from "hono";
import { getRedis } from "../redis";

/** Rate limit configuration. */
interface RateLimitConfig {
  /** Maximum requests allowed in the window. */
  max: number;
  /** Window duration in seconds. */
  windowSeconds: number;
}

const PUBLIC_LIMIT: RateLimitConfig = { max: 60, windowSeconds: 60 };
const AUTH_LIMIT: RateLimitConfig = { max: 120, windowSeconds: 60 };
const WRITE_LIMIT: RateLimitConfig = { max: 30, windowSeconds: 60 };

/** In-memory fallback when Redis is unavailable. */
const memoryStore = new Map<string, { count: number; resetAt: number }>();

/** Check rate limit using Redis INCR + EXPIRE. */
async function checkRedis(
  key: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRedis();
  if (!redis) {
    return checkMemory(key, config);
  }

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, config.windowSeconds);
    }
    const remaining = Math.max(0, config.max - count);
    return { allowed: count <= config.max, remaining };
  } catch {
    // Redis error -- fall back to memory
    return checkMemory(key, config);
  }
}

/** In-memory rate limit check (dev fallback). */
function checkMemory(
  key: string,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    });
    return { allowed: true, remaining: config.max - 1 };
  }

  entry.count++;
  const remaining = Math.max(0, config.max - entry.count);
  return { allowed: entry.count <= config.max, remaining };
}

/**
 * Rate limiting middleware for public endpoints.
 * Limits by client IP address.
 */
export async function publicRateLimit(c: Context, next: Next) {
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown";

  const key = `rl:pub:${ip}`;
  const { allowed, remaining } = await checkRedis(key, PUBLIC_LIMIT);

  c.header("X-RateLimit-Limit", String(PUBLIC_LIMIT.max));
  c.header("X-RateLimit-Remaining", String(remaining));

  if (!allowed) {
    return c.json(
      { error: "Too many requests. Try again in a minute." },
      429,
    );
  }

  await next();
}

/**
 * Rate limiting middleware for authenticated API endpoints.
 * Limits by user ID. Applies stricter limits to write operations.
 */
export async function apiRateLimit(c: Context, next: Next) {
  const user = c.get("user") as { id: string } | undefined;
  const identifier = user?.id ?? "anon";
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method);
  const config = isWrite ? WRITE_LIMIT : AUTH_LIMIT;
  const prefix = isWrite ? "rl:write" : "rl:api";
  const key = `${prefix}:${identifier}`;

  const { allowed, remaining } = await checkRedis(key, config);

  c.header("X-RateLimit-Limit", String(config.max));
  c.header("X-RateLimit-Remaining", String(remaining));

  if (!allowed) {
    return c.json(
      { error: "Too many requests. Try again in a minute." },
      429,
    );
  }

  await next();
}
