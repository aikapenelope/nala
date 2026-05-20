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

import "./instrument"; // Must be first — initializes Sentry/Bugsink before other imports
import { serve } from "@hono/node-server";
import { config } from "./config"; // Validates env vars on import
import { app } from "./app";
import { initDb, applyRlsPolicies } from "./db";
import { initRedis, closeRedis } from "./redis";
import { initStorage } from "./services/storage";
import { logger } from "./logger";

// Initialize database (required in production, optional in dev)
if (config.databaseUrl) {
  try {
    initDb();
    logger.info("startup", "Database connected");

    // Apply RLS policies (idempotent, safe on every deploy)
    await applyRlsPolicies();
    logger.info("startup", "RLS policies applied");
  } catch (err) {
    logger.fatal("startup", "Database connection failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
} else if (!config.isDev) {
  logger.fatal("startup", "DATABASE_URL is required in production");
  process.exit(1);
}

// Initialize Redis (optional, degrades gracefully)
if (config.redisUrl) {
  const redis = initRedis();
  if (redis) {
    logger.info("startup", "Redis connected");
  }
} else {
  logger.warn("startup", "Redis not configured, exchange rate caching disabled");
}

// Initialize MinIO storage (optional, degrades gracefully)
await initStorage();

// Start server
logger.info("startup", "Nova API starting", { port: config.port });

const server = serve({
  fetch: app.fetch,
  port: config.port,
});

logger.info("startup", "Nova API running", { port: config.port });

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

  logger.info("shutdown", "Signal received, closing server", { signal });

  // Force exit after timeout if graceful shutdown hangs
  const forceTimer = setTimeout(() => {
    logger.error("shutdown", "Timeout reached, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  // Stop accepting new connections, wait for in-flight to finish
  server.close(async () => {
    logger.info("shutdown", "HTTP server closed");

    try {
      await closeRedis();
      logger.info("shutdown", "Redis disconnected");
    } catch {
      // Non-critical: Redis may already be disconnected
    }

    logger.info("shutdown", "Clean exit");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
