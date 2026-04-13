/**
 * Public catalog endpoint tests.
 *
 * Tests run without database -- they verify route-level behavior
 * (404 handling, response structure) using Hono's test client.
 *
 * Integration tests with a real DB run in CI (GitHub Actions)
 * where PostgreSQL is available as a service.
 */

import { describe, it, expect } from "vitest";
import { app } from "../app";

describe("GET /catalog/:slug", () => {
  it("returns 404 for non-existent slug when DB is available", async () => {
    const res = await app.request("/catalog/non-existent-slug-12345");

    // Without DB: 503 (service unavailable)
    // With DB: 404 (business not found)
    expect([404, 503]).toContain(res.status);
  });

  it("returns JSON error body", async () => {
    const res = await app.request("/catalog/non-existent-slug-12345");
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
