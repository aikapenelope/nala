/**
 * Prometheus metrics for the Nova API.
 *
 * Exposes application-level metrics in Prometheus format at GET /metrics.
 * Prometheus on the Observability Plane scrapes this endpoint every 15s.
 *
 * Metrics exported:
 * - http_requests_total: Counter of all HTTP requests (method, path, status)
 * - http_request_duration_seconds: Histogram of request latency (method, path)
 * - Default Node.js metrics: CPU, RAM, event loop lag, GC, active handles
 *
 * Usage:
 *   1. Import metricsMiddleware and metricsEndpoint in app.ts
 *   2. Add metricsMiddleware as a global middleware (after logger, before routes)
 *   3. Add metricsEndpoint as a route (alongside /health)
 *
 * This file is designed to be copy-pasted into any Hono-based API project.
 * Only dependency: `prom-client` (npm install prom-client)
 */

import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from "prom-client";
import type { Context, Next } from "hono";

// ---------------------------------------------------------------------------
// Registry (one per process)
// ---------------------------------------------------------------------------

export const metricsRegistry = new Registry();

// Default Node.js metrics: CPU usage, memory, event loop lag, GC pauses, etc.
// These are invaluable for detecting memory leaks and event loop blocking.
collectDefaultMetrics({ register: metricsRegistry });

// ---------------------------------------------------------------------------
// Custom application metrics
// ---------------------------------------------------------------------------

/**
 * Total HTTP requests counter.
 * Labels: method (GET/POST/...), path (/api/sales, /health, ...), status (200/404/500/...)
 */
export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "path", "status"] as const,
  registers: [metricsRegistry],
});

/**
 * HTTP request duration histogram.
 * Labels: method, path
 * Buckets optimized for API latency: 10ms to 10s
 */
export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path"] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

// ---------------------------------------------------------------------------
// Middleware: measures every request
// ---------------------------------------------------------------------------

/**
 * Metrics middleware — records request count and duration.
 *
 * Place AFTER the logger middleware and BEFORE route definitions.
 * Uses `c.req.routePath` when available (matched route pattern like "/api/sales/:id")
 * to avoid high-cardinality labels from dynamic paths.
 */
export async function metricsMiddleware(c: Context, next: Next) {
  const start = performance.now();

  await next();

  const duration = (performance.now() - start) / 1000;
  // Use route pattern (e.g., "/api/sales/:id") instead of actual path
  // to prevent label explosion from dynamic segments (UUIDs, etc.)
  const path = c.req.routePath || c.req.path;
  const method = c.req.method;
  const status = String(c.res.status);

  httpRequestsTotal.inc({ method, path, status });
  httpRequestDuration.observe({ method, path }, duration);
}

// ---------------------------------------------------------------------------
// Endpoint: GET /metrics
// ---------------------------------------------------------------------------

/**
 * Metrics endpoint handler for Prometheus scraping.
 *
 * Returns all registered metrics in Prometheus text format.
 * No authentication required — only accessible from private network.
 */
export async function metricsEndpoint(c: Context) {
  const metrics = await metricsRegistry.metrics();
  return c.text(metrics, 200, {
    "Content-Type": metricsRegistry.contentType,
  });
}
