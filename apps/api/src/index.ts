/**
 * Nova API - Entry point.
 *
 * Hono-based REST API for the Nova backoffice system.
 * Runs on Node.js via @hono/node-server.
 */

import { serve } from "@hono/node-server";
import { app } from "./app";
import { initDb } from "./db";
import { initRedis } from "./redis";

const port = Number(process.env.PORT) || 3001;

// Initialize services before starting the server
if (process.env.DATABASE_URL) {
  initDb();
  console.log("Database connected.");
} else {
  console.warn("DATABASE_URL not set. Running in dev mode without DB.");
}

const redis = initRedis();
if (redis) {
  console.log("Redis connected.");
}

console.log(`Nova API starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`Nova API running at http://localhost:${port}`);
