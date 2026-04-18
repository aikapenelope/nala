/**
 * Health check endpoint.
 *
 * Returns the status of the API and its dependent services.
 * Used by monitoring tools (Uptime Kuma) and load balancers.
 *
 * HTTP status codes:
 * - 200: Process is alive and can serve requests
 * - 503: Process is alive but critical services (DB) are down
 *
 * The response body always contains honest service status regardless
 * of the HTTP code. Monitoring tools should check body.services for
 * detailed status.
 */

import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { HealthCheckResponse } from "@nova/shared";
import { tryGetDb } from "../db";
import { getRedis } from "../redis";

export const health = new Hono();

health.get("/", async (c) => {
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
});
