/**
 * Hono application setup with middleware and routes.
 *
 * Middleware chain:
 * 1. Logger - request/response logging
 * 2. CORS - cross-origin access for the frontend
 * 3. Auth - verify Clerk JWT or PIN (placeholder in Phase 0)
 * 4. Tenant - set RLS business context (placeholder in Phase 0)
 *
 * Routes:
 * - /health - health check (no auth required)
 * - /api/* - protected API routes (auth + tenant required)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { health } from "./routes/health";
import { auth } from "./routes/auth";
import { onboarding } from "./routes/onboarding";
import { inventory } from "./routes/inventory";
import { authMiddleware } from "./middleware/auth";
import { tenantMiddleware } from "./middleware/tenant";
import type { AppEnv } from "./types";

export const app = new Hono();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// Public routes (no auth required)
app.route("/health", health);
app.route("/auth", auth);
app.route("/onboarding", onboarding);

// Protected API routes with typed context variables
const api = new Hono<AppEnv>();
api.use("*", authMiddleware);
api.use("*", tenantMiddleware);

// Placeholder route to verify middleware chain works
api.get("/me", (c) => {
  const user = c.get("user");
  return c.json({ user });
});

// Inventory routes (products, categories, variants)
api.route("/", inventory);

app.route("/api", api);

// Root
app.get("/", (c) => {
  return c.json({
    name: "Nova API",
    version: "0.0.0",
    status: "running",
  });
});
