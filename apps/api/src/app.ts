/**
 * Hono application setup with middleware and routes.
 *
 * Middleware chain:
 * 1. Security - block scanner bots, security headers
 * 2. Logger - request/response logging (only valid routes)
 * 3. CORS - cross-origin access for the frontend
 * 4. Auth - verify Clerk JWT
 * 5. Tenant - set RLS business context
 *
 * Routes:
 * - /health - health check (no auth required)
 * - /onboarding - business creation (Clerk JWT required)
 * - /api/* - protected API routes (auth + tenant required, uses Clerk JWT)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { Sentry } from "./instrument";
import { bodyLimit } from "hono/body-limit";
import { timeout } from "hono/timeout";
import { structuredLogger } from "./middleware/structured-logger";
import { metricsMiddleware, metricsEndpoint } from "./metrics";
import { health } from "./routes/health";
import { catalog } from "./routes/catalog";
import { images } from "./routes/images";
import { onboarding } from "./routes/onboarding";
import { inventory } from "./routes/inventory";
import { salesRoutes } from "./routes/sales";
import { customersRoutes } from "./routes/customers";
import { reports } from "./routes/reports";
import { accounting } from "./routes/accounting";
import { businessSettings } from "./routes/business-settings";
import { ownerLock } from "./routes/owner-lock";
import { suppliersRoutes } from "./routes/suppliers";
import { configRoutes } from "./routes/config";
import { ordersRoutes } from "./routes/orders";
import { pushRoutes } from "./routes/push";
import { dashboardRoutes } from "./routes/dashboard";
import { authMiddleware } from "./middleware/auth";
import { tenantMiddleware } from "./middleware/tenant";
import { publicRateLimit, apiRateLimit } from "./middleware/rate-limit";
import type { AppEnv } from "./types";

export const app = new Hono();

// ---------------------------------------------------------------------------
// Global error handler: catch all unhandled errors, log them, return 500
// ---------------------------------------------------------------------------

app.onError((err, c) => {
  const method = c.req.method;
  const path = c.req.path;
  const requestId = (c.var as Record<string, unknown>).requestId as string ?? "unknown";
  const message = err instanceof Error ? err.message : "Unknown error";
  const stack = err instanceof Error ? err.stack : undefined;

  // Send to Bugsink (non-blocking)
  Sentry.captureException(err, {
    tags: { requestId, method, path },
  });

  // Structured error log with requestId for correlation
  const errorEntry = {
    level: "error",
    method,
    path,
    requestId,
    error: message,
    ...(stack && { stack }),
  };
  process.stderr.write(JSON.stringify(errorEntry) + "\n");

  // Don't leak internal details in production
  const isDev = process.env.NODE_ENV === "development";

  return c.json(
    {
      error: isDev ? message : "Internal server error",
      requestId,
      path,
      ...(isDev && { stack }),
    },
    500,
  );
});

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
//
// Two configurations:
// - /images/*: Cross-Origin-Resource-Policy set to "cross-origin" so that
//   <img> tags on the frontend (novaincs.com) can load images from the API
//   (api.novaincs.com). These are different origins, and the default
//   "same-origin" blocks the browser from rendering the image.
// - Everything else: default "same-origin" for maximum protection.
// ---------------------------------------------------------------------------

app.use(
  "/images/*",
  secureHeaders({ crossOriginResourcePolicy: "cross-origin" }),
);
app.use("*", secureHeaders());

// ---------------------------------------------------------------------------
// Body size limit: reject requests larger than 1MB to prevent DoS
// ---------------------------------------------------------------------------

app.use("*", bodyLimit({ maxSize: 1024 * 1024 }));

// ---------------------------------------------------------------------------
// Request timeout: abort requests that take longer than 30 seconds
// ---------------------------------------------------------------------------

app.use("*", timeout(30_000));

// ---------------------------------------------------------------------------
// Logger (only runs for legitimate requests, scanners are already blocked)
// ---------------------------------------------------------------------------

app.use("*", structuredLogger);

// ---------------------------------------------------------------------------
// Metrics: count requests and measure latency for Prometheus
// ---------------------------------------------------------------------------

app.use("*", metricsMiddleware);

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = process.env.CORS_ORIGIN?.split(",") ?? [
        "http://localhost:3000",
      ];

      // Exact match (e.g., https://novaincs.com)
      if (allowed.includes(origin)) return origin;

      // Wildcard match for tenant subdomains (e.g., https://bodega.novaincs.com)
      const tenantDomain = process.env.TENANT_DOMAIN;
      if (
        tenantDomain &&
        (origin.endsWith(`.${tenantDomain}`) ||
          origin === `https://${tenantDomain}`)
      ) {
        return origin;
      }

      return allowed[0] ?? "";
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// ---------------------------------------------------------------------------
// Public routes (no auth required)
// ---------------------------------------------------------------------------

app.route("/health", health);
app.get("/metrics", metricsEndpoint);
app.use("/catalog/*", publicRateLimit);
app.route("/catalog", catalog);
app.use("/images/*", publicRateLimit);
app.route("/images", images);
app.use("/onboarding/check-slug/*", publicRateLimit);
app.use("/onboarding", publicRateLimit);
app.route("/onboarding", onboarding);

// ---------------------------------------------------------------------------
// Protected API routes with typed context variables
// ---------------------------------------------------------------------------

const api = new Hono<AppEnv>();
api.use("*", authMiddleware);
api.use("*", tenantMiddleware);
api.use("*", apiRateLimit);

// User info route
api.get("/me", (c) => {
  const user = c.get("user");
  return c.json({ user });
});

// Consolidated dashboard (single call replaces 12 individual calls)
api.route("/", dashboardRoutes);

// Business settings
api.route("/", businessSettings);

// Owner lock (PIN for sensitive sections)
api.route("/", ownerLock);

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

// Supplier management
api.route("/", suppliersRoutes);

// Business configuration (surcharges, bank accounts, notifications)
api.route("/", configRoutes);

// Online orders and store settings
api.route("/", ordersRoutes);

// Push notification subscriptions
api.route("/", pushRoutes);

app.route("/api", api);

// ---------------------------------------------------------------------------
// 404 handler for unmatched routes
// ---------------------------------------------------------------------------

app.notFound((c) => {
  return c.json({ error: "Not found", path: c.req.path }, 404);
});

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

app.get("/", (c) => {
  return c.json({
    name: "Nova API",
    version: "2.0.0",
    status: "running",
    build: "clerk-simple",
  });
});
