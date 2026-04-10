/**
 * Nova API - Entry point.
 *
 * Hono-based REST API for the Nova backoffice system.
 * Runs on Node.js via @hono/node-server.
 */

import { serve } from "@hono/node-server";
import { app } from "./app";

const port = Number(process.env.PORT) || 3001;

console.log(`Nova API starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`Nova API running at http://localhost:${port}`);
