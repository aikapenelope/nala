/**
 * Nova API - Entry point.
 *
 * Hono-based REST API for the Nova backoffice system.
 * Runs on Node.js via @hono/node-server.
 *
 * Startup sequence:
 * 1. Validate environment variables (exits if missing in production)
 * 2. Initialize database connection
 * 3. Initialize Redis connection
 * 4. Start HTTP server
 */

import { serve } from "@hono/node-server";
import { config } from "./config"; // Validates env vars on import
import { app } from "./app";
import { initDb } from "./db";
import { initRedis } from "./redis";

// Initialize database (required in production, optional in dev)
if (config.databaseUrl) {
  try {
    initDb();
    console.log("[startup] Database connected.");
  } catch (err) {
    console.error("[startup] FATAL: Database connection failed:", err);
    process.exit(1);
  }
} else if (!config.isDev) {
  console.error("[startup] FATAL: DATABASE_URL is required in production.");
  process.exit(1);
}

// Initialize Redis (optional, degrades gracefully)
if (config.redisUrl) {
  const redis = initRedis();
  if (redis) {
    console.log("[startup] Redis connected.");
  }
} else {
  console.warn(
    "[startup] Redis not configured. Exchange rate caching disabled.",
  );
}

// Start server
console.log(`[startup] Nova API starting on port ${config.port}...`);

serve({
  fetch: app.fetch,
  port: config.port,
});

console.log(`[startup] Nova API running at http://localhost:${config.port}`);
