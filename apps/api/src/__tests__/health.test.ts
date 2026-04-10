/**
 * Health check endpoint tests.
 */

import { describe, it, expect } from "vitest";
import { app } from "../app";

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(body.services).toBeDefined();
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
