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
  Gauge,
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
// Infrastructure metrics
// ---------------------------------------------------------------------------

/**
 * Number of database queries currently in-flight.
 * Approximates pool utilization: if this approaches the pool max (20),
 * queries are likely waiting for a free connection.
 */
export const dbQueriesInFlight = new Gauge({
  name: "db_queries_inflight",
  help: "Number of database queries currently executing",
  registers: [metricsRegistry],
});

/**
 * Total Redis operations counter.
 * Labels: operation (get/set/eval/etc.), status (ok/error)
 * Tracks how Nova interacts with Redis — not Redis health itself.
 */
export const redisOperationsTotal = new Counter({
  name: "redis_operations_total",
  help: "Total Redis operations from the application",
  labelNames: ["operation", "status"] as const,
  registers: [metricsRegistry],
});

// ---------------------------------------------------------------------------
// Path normalization (fallback when routePath is unavailable)
// ---------------------------------------------------------------------------

/** Paths to exclude from metrics (internal/infra endpoints). */
const EXCLUDED_PATHS = new Set(["/metrics", "/health"]);

/**
 * Normalize a URL path by replacing UUIDs and numeric IDs with placeholders.
 * Used as fallback when `c.req.routePath` is not available (e.g., 404 handlers).
 * Prevents label cardinality explosion in Prometheus.
 */
function normalizePath(path: string): string {
  return path
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ":id",
    )
    .replace(/\/\d+/g, "/:id");
}

// ---------------------------------------------------------------------------
// Middleware: measures every request
// ---------------------------------------------------------------------------

/**
 * Metrics middleware — records request count and duration.
 *
 * Place AFTER the logger middleware and BEFORE route definitions.
 * Uses `c.req.routePath` when available (matched route pattern like "/api/sales/:id")
 * to avoid high-cardinality labels from dynamic paths.
 *
 * Excludes /metrics and /health to avoid noise from Prometheus scrapes
 * and load balancer health checks.
 */
export async function metricsMiddleware(c: Context, next: Next) {
  const start = performance.now();

  await next();

  // Skip internal endpoints (Prometheus scrapes, health checks)
  const rawPath = c.req.path;
  if (EXCLUDED_PATHS.has(rawPath)) return;

  const duration = (performance.now() - start) / 1000;
  // Use route pattern (e.g., "/api/sales/:id") instead of actual path.
  // Fall back to normalized path to prevent label explosion from UUIDs.
  const path = c.req.routePath || normalizePath(rawPath);
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
