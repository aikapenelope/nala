/**
 * Health check endpoint.
 *
 * Returns the status of the API and its dependent services.
 * Used by monitoring tools (Uptime Kuma) and load balancers.
 */

import { Hono } from "hono";
import type { HealthCheckResponse } from "@nova/shared";

export const health = new Hono();

health.get("/", (c) => {
  const response: HealthCheckResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      database: false, // Will be connected in Sprint 0.2
      redis: false, // Will be connected in Sprint 0.2
    },
  };

  return c.json(response);
});
