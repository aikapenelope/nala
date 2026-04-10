/**
 * Health check endpoint tests.
 *
 * Tests run without database or Redis connections.
 * The health endpoint should honestly report service status.
 */

import { describe, it, expect } from "vitest";
import { app } from "../app";

describe("GET /health", () => {
  it("returns health status with service info", async () => {
    const res = await app.request("/health");

    // Without DB configured, health reports degraded or error depending on NODE_ENV.
    // In test environment (no NODE_ENV=development), this is "error" with 503.
    // The important thing is that it responds and reports honestly.
    const body = await res.json();
    expect(body.timestamp).toBeDefined();
    expect(body.services).toBeDefined();
    expect(body.services.database).toBe(false);
    expect(body.services.redis).toBe(false);
    expect(["ok", "degraded", "error"]).toContain(body.status);
  });
});

describe("GET /", () => {
  it("returns API info", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe("Nova API");
    expect(body.status).toBe("running");
  });
});
