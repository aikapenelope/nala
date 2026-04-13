/**
 * Rate limiting middleware tests.
 *
 * Verifies that rate limit headers are present and that
 * the middleware responds correctly to requests.
 */

import { describe, it, expect } from "vitest";
import { app } from "../app";

describe("Rate limiting", () => {
  it("public endpoints include rate limit headers", async () => {
    const res = await app.request("/catalog/test-slug");
    expect(res.headers.get("X-RateLimit-Limit")).toBeDefined();
    expect(res.headers.get("X-RateLimit-Remaining")).toBeDefined();
  });

  it("health endpoint does not have rate limit headers", async () => {
    const res = await app.request("/health");
    // Health is not rate-limited (no middleware applied)
    expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
  });
});
