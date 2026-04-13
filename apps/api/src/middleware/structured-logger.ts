/**
 * Structured JSON logging middleware.
 *
 * Replaces hono/logger with JSON output for production observability.
 * Each log line is a single JSON object with:
 * - method, path, status, ms (request info)
 * - requestId (correlation ID, short uuid)
 * - userId, businessId (when available, post-auth)
 *
 * In development, also prints a human-readable summary to stderr.
 */

import { createMiddleware } from "hono/factory";
import crypto from "node:crypto";

/** Generate a short request ID (8 hex chars). */
function shortId(): string {
  return crypto.randomBytes(4).toString("hex");
}

/**
 * Structured logger middleware.
 *
 * Sets `requestId` on the context for downstream use.
 * Logs one JSON line per request on completion.
 */
export const structuredLogger = createMiddleware(async (c, next) => {
  const requestId = shortId();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);

  const start = performance.now();

  await next();

  const ms = Math.round(performance.now() - start);
  const status = c.res.status;
  const method = c.req.method;
  const path = c.req.path;

  // Extract user context if available (set by auth middleware).
  const user = c.get("user") as { id?: string } | undefined;
  const businessId = c.get("businessId") as string | undefined;

  const entry: Record<string, unknown> = {
    level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
    method,
    path,
    status,
    ms,
    requestId,
  };

  if (user?.id) entry.userId = user.id;
  if (businessId) entry.businessId = businessId;

  // Single JSON line to stdout (parseable by log aggregators).
  process.stdout.write(JSON.stringify(entry) + "\n");
});
