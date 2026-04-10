/**
 * Health check endpoint.
 *
 * Returns the status of the API and its dependent services.
 * Used by monitoring tools (Uptime Kuma) and load balancers.
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

  // Test database connectivity (graceful when DB not configured)
  const db = tryGetDb();
  if (db) {
    try {
      await db.execute(sql`SELECT 1`);
      dbOk = true;
    } catch {
      // DB connection failed
    }
  }

  // Test Redis connectivity
  const redis = getRedis();
  if (redis) {
    try {
      await redis.ping();
      redisOk = true;
    } catch {
      // Redis connection failed
    }
  }

  // Status logic:
  // - "ok" when DB is connected (Redis is optional)
  // - "degraded" when DB is connected but Redis is not
  // - "error" when DB is not connected
  let status: HealthCheckResponse["status"];
  if (!db) {
    // DB not configured at all (dev mode) - report as ok
    status = "ok";
  } else if (dbOk) {
    status = redisOk ? "ok" : "degraded";
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

  return c.json(response, status === "error" ? 503 : 200);
});
