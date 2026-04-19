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
 *
 * Shutdown sequence (SIGTERM/SIGINT):
 * 1. Stop accepting new connections
 * 2. Wait for in-flight requests to complete (10s timeout)
 * 3. Close Redis connection
 * 4. Exit cleanly
 */

import { serve } from "@hono/node-server";
import { config } from "./config"; // Validates env vars on import
import { app } from "./app";
import { initDb } from "./db";
import { initRedis, closeRedis } from "./redis";

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

const server = serve({
  fetch: app.fetch,
  port: config.port,
});

console.log(`[startup] Nova API running at http://localhost:${config.port}`);

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

/** Maximum time to wait for in-flight requests before force-closing (ms). */
const SHUTDOWN_TIMEOUT_MS = 10_000;

let isShuttingDown = false;

/**
 * Handle shutdown signals (SIGTERM from Docker/Coolify, SIGINT from Ctrl+C).
 *
 * 1. Stop accepting new connections (server.close)
 * 2. Wait for in-flight requests to finish (up to 10s)
 * 3. Close Redis
 * 4. Exit 0
 */
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[shutdown] ${signal} received. Closing server...`);

  // Force exit after timeout if graceful shutdown hangs
  const forceTimer = setTimeout(() => {
    console.error("[shutdown] Timeout reached. Forcing exit.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  // Stop accepting new connections, wait for in-flight to finish
  server.close(async () => {
    console.log("[shutdown] HTTP server closed.");

    try {
      await closeRedis();
      console.log("[shutdown] Redis disconnected.");
    } catch {
      // Non-critical: Redis may already be disconnected
    }

    console.log("[shutdown] Clean exit.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
