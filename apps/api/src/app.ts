/**
 * Hono application setup with middleware and routes.
 *
 * Middleware chain:
 * 1. Security - block scanner bots, security headers
 * 2. Logger - request/response logging (only valid routes)
 * 3. CORS - cross-origin access for the frontend
 * 4. Auth - verify Clerk JWT + resolve X-Acting-As
 * 5. Tenant - set RLS business context
 *
 * Routes:
 * - /health - health check (no auth required)
 * - /onboarding - business creation (Clerk JWT required, handled internally)
 * - /webhooks/whatsapp - Meta webhook (no auth)
 * - /api/* - protected API routes (auth + tenant required)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { health } from "./routes/health";
import { ownerPinRoute } from "./routes/auth";
import { onboarding } from "./routes/onboarding";
import { inventory } from "./routes/inventory";
import { salesRoutes } from "./routes/sales";
import { customersRoutes } from "./routes/customers";
import { reports } from "./routes/reports";
import { accounting } from "./routes/accounting";
import { whatsapp } from "./routes/whatsapp";
import { team } from "./routes/team";
import { authMiddleware } from "./middleware/auth";
import { tenantMiddleware } from "./middleware/tenant";
import type { AppEnv } from "./types";

export const app = new Hono();

// ---------------------------------------------------------------------------
// Security: block scanner bots early (before logging to reduce noise)
// ---------------------------------------------------------------------------

/** Paths that scanners probe. Return 404 immediately without logging. */
const SCANNER_PATHS = new Set([
  "/.env",
  "/.git/config",
  "/.git/HEAD",
  "/.vscode/sftp.json",
  "/wp-login.php",
  "/wp-admin",
  "/xmlrpc.php",
  "/config.json",
  "/info.php",
  "/phpinfo.php",
  "/telescope/requests",
  "/actuator/env",
  "/actuator/health",
  "/swagger-ui.html",
  "/swagger/index.html",
  "/swagger/swagger-ui.html",
  "/swagger.json",
  "/swagger/v1/swagger.json",
  "/v2/api-docs",
  "/v3/api-docs",
  "/api-docs/swagger.json",
  "/trace.axd",
  "/@vite/env",
  "/debug/default/view",
  "/webjars/swagger-ui/index.html",
]);

app.use("*", async (c, next) => {
  const path = c.req.path;

  // Block known scanner paths silently
  if (SCANNER_PATHS.has(path)) {
    return c.text("", 404);
  }

  // Block common scanner patterns
  if (
    path.endsWith(".php") ||
    path.endsWith(".asp") ||
    path.endsWith(".aspx") ||
    path.endsWith(".jsp") ||
    path.includes("/wp-") ||
    path.includes("/wordpress") ||
    path.includes("/cgi-bin")
  ) {
    return c.text("", 404);
  }

  await next();
});

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

app.use("*", secureHeaders());

// ---------------------------------------------------------------------------
// Logger (only runs for legitimate requests, scanners are already blocked)
// ---------------------------------------------------------------------------

app.use("*", logger());

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Business-Id",
      "X-Acting-As",
    ],
  }),
);

// ---------------------------------------------------------------------------
// Public routes (no auth required)
// ---------------------------------------------------------------------------

app.route("/health", health);
app.route("/onboarding", onboarding);
app.route("/webhooks/whatsapp", whatsapp);

// ---------------------------------------------------------------------------
// Protected API routes with typed context variables
// ---------------------------------------------------------------------------

const api = new Hono<AppEnv>();
api.use("*", authMiddleware);
api.use("*", tenantMiddleware);

// User info route
api.get("/me", (c) => {
  const user = c.get("user");
  return c.json({ user });
});

// Owner PIN verification (protected - uses businessId from session)
api.route("/", ownerPinRoute);

// Team management (roster download, user switching)
api.route("/", team);

// Inventory routes (products, categories, variants)
api.route("/", inventory);

// Sales routes (sales, exchange rate, quotations)
api.route("/", salesRoutes);

// Customer and accounts routes
api.route("/", customersRoutes);

// Reports routes
api.route("/", reports);

// Accounting and OCR routes
api.route("/", accounting);

app.route("/api", api);

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

app.get("/", (c) => {
  return c.json({
    name: "Nova API",
    version: "1.0.0",
    status: "running",
  });
});
