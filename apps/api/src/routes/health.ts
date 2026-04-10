/**
 * Health check endpoint.
 *
 * Returns the status of the API and its dependent services.
 * Used by monitoring tools (Uptime Kuma) and load balancers.
 */

import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { HealthCheckResponse } from "@nova/shared";
import { getDb } from "../db";
import { getRedis } from "../redis";

export const health = new Hono();

health.get("/", async (c) => {
  let dbOk = false;
  let redisOk = false;

  // Test database connectivity
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    // DB not available
  }

  // Test Redis connectivity
  try {
    const redis = getRedis();
    if (redis) {
      await redis.ping();
      redisOk = true;
    }
  } catch {
    // Redis not available
  }

  const status = dbOk ? (redisOk ? "ok" : "degraded") : "error";

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
