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

  // Test database connectivity
  const db = tryGetDb();
  if (db) {
    try {
      await db.execute(sql`SELECT 1`);
      dbOk = true;
    } catch {
      // DB connection failed - will be reflected in response
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

  const response: HealthCheckResponse = {
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk,
      redis: redisOk,
    },
  };

  // Return 503 only when DB is configured but unreachable.
  // This tells load balancers to stop sending traffic.
  const httpStatus = status === "error" ? 503 : 200;

  return c.json(response, httpStatus);
});
