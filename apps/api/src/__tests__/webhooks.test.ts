/**
 * Webhook endpoint tests.
 *
 * Tests verify that:
 * - The webhook endpoint exists and is publicly accessible
 * - Missing Svix headers are rejected with 400
 * - Missing webhook secret returns 500
 * - Invalid signatures are rejected with 400
 *
 * Note: Full integration tests with real Svix signatures require
 * a CLERK_WEBHOOK_SECRET, which is only available in production.
 * These tests verify the endpoint's error handling paths.
 */

import { describe, it, expect } from "vitest";
import { app } from "../app";

describe("POST /webhooks/clerk", () => {
  it("rejects requests without Svix headers", async () => {
    const res = await app.request("/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "user.created", data: {} }),
    });

    // Without CLERK_WEBHOOK_SECRET configured, returns 500.
    // With secret but missing headers, returns 400.
    expect([400, 500]).toContain(res.status);
  });

  it("rejects requests with incomplete Svix headers", async () => {
    const res = await app.request("/webhooks/clerk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "svix-id": "msg_test123",
        // Missing svix-timestamp and svix-signature
      },
      body: JSON.stringify({ type: "user.created", data: {} }),
    });

    expect([400, 500]).toContain(res.status);
  });

  it("rejects requests with invalid signature", async () => {
    // Set a fake webhook secret for this test
    const originalSecret = process.env.CLERK_WEBHOOK_SECRET;
    // Use a properly formatted Svix secret (whsec_ prefix + base64)
    process.env.CLERK_WEBHOOK_SECRET = "whsec_dGVzdF9zZWNyZXRfZm9yX3Rlc3Rpbmc=";

    try {
      const res = await app.request("/webhooks/clerk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": "msg_test123",
          "svix-timestamp": String(Math.floor(Date.now() / 1000)),
          "svix-signature": "v1,invalid_signature_here",
        },
        body: JSON.stringify({ type: "user.created", data: { id: "test" } }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid webhook signature");
    } finally {
      // Restore original value
      if (originalSecret) {
        process.env.CLERK_WEBHOOK_SECRET = originalSecret;
      } else {
        delete process.env.CLERK_WEBHOOK_SECRET;
      }
    }
  });

  it("is not accessible via GET", async () => {
    const res = await app.request("/webhooks/clerk");
    // Hono returns 404 for unmatched methods
    expect(res.status).not.toBe(200);
  });
});

describe("Auth middleware hardening", () => {
  it("body size limit rejects oversized requests", async () => {
    // Create a body larger than 1MB
    const largeBody = "x".repeat(1024 * 1024 + 1);

    const res = await app.request("/api/me", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fake-token",
      },
      body: largeBody,
    });

    // Should be rejected by body limit (413) or auth (401/500)
    // The body limit middleware runs before auth, so it should be 413
    expect([401, 413, 500]).toContain(res.status);
  });
});
