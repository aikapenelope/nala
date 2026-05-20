/**
 * Health check endpoints.
 *
 * Two probes following Kubernetes/Docker best practices:
 *
 * GET /health/live  — Liveness probe
 *   Returns 200 if the process is alive and can handle requests.
 *   Does NOT check external dependencies (DB, Redis).
 *   Used by Docker HEALTHCHECK and orchestrators to detect crashed processes.
 *   If this fails, the container should be restarted.
 *
 * GET /health/ready — Readiness probe
 *   Returns 200 if the process can serve traffic (DB + Redis connected).
 *   Returns 503 if critical dependencies are down.
 *   Used by load balancers to stop routing traffic to unhealthy instances.
 *   During migrations or DB restarts, this returns 503 but the container
 *   should NOT be restarted (liveness is still 200).
 *
 * GET /health       — Legacy (alias for /health/ready, backward compatible)
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "drizzle-orm";
import type { HealthCheckResponse } from "@nova/shared";
import { tryGetDb } from "../db";
import { getRedis } from "../redis";

export const health = new Hono();

/**
 * Liveness probe: process is alive.
 * Always returns 200 — if this endpoint responds, the process is healthy.
 * No external dependency checks (those belong in readiness).
 */
health.get("/live", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * Readiness probe: process can serve traffic.
 * Checks DB connectivity (read + write) and Redis.
 */
health.get("/ready", async (c) => {
  return readinessCheck(c);
});

/** Legacy endpoint (backward compatible — same as /ready). */
health.get("/", async (c) => {
  return readinessCheck(c);
});

async function readinessCheck(c: Context) {
  let dbOk = false;
  let redisOk = false;

  // Test database connectivity (read + write).
  // The write test catches disk-full or read-only filesystem conditions
  // that a simple SELECT 1 would miss.
  let dbWriteOk = false;
  const db = tryGetDb();
  if (db) {
    try {
      await db.execute(sql`SELECT 1`);
      dbOk = true;

      // Lightweight write test: create and drop a temp table.
      // Temp tables are session-scoped and don't touch user data.
      await db.execute(
        sql`CREATE TEMP TABLE IF NOT EXISTS _health_write_test (ts timestamptz)`,
      );
      await db.execute(
        sql`INSERT INTO _health_write_test VALUES (now()) ON CONFLICT DO NOTHING`,
      );
      await db.execute(sql`DROP TABLE IF EXISTS _health_write_test`);
      dbWriteOk = true;
    } catch {
      // DB connection or write failed - will be reflected in response
    }
  }

  // Test Redis connectivity
  const redis = getRedis();
  if (redis) {
    try {
      await redis.ping();
      redisOk = true;
    } catch {
      // Redis connection failed - will be reflected in response
    }
  }

  // Status determination:
  // - "ok": DB is connected (Redis optional)
  // - "degraded": DB connected but Redis is not
  // - "error": DB is not connected or not configured
  let status: HealthCheckResponse["status"];
  if (dbOk) {
    status = redisOk || !redis ? "ok" : "degraded";
  } else if (!db) {
    // DB not initialized - only acceptable in development
    status = process.env.NODE_ENV === "development" ? "degraded" : "error";
  } else {
    status = "error";
  }

  const response = {
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk,
      databaseWrite: dbWriteOk,
      redis: redisOk,
    },
  } satisfies HealthCheckResponse & {
    services: { databaseWrite: boolean };
  };

  // Return 503 only when DB is configured but unreachable.
  // This tells load balancers to stop sending traffic.
  const httpStatus = status === "error" ? 503 : 200;

  return c.json(response, httpStatus);
}
