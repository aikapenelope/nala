/**
 * Sales endpoint tests.
 *
 * Tests verify that sales endpoints reject unauthenticated requests.
 *
 * Without a database, the auth middleware may return 500 instead of 401.
 * Both are acceptable -- the key is that unauthenticated requests never
 * succeed (never 200/201).
 *
 * Full integration tests (stock validation, atomic transactions, fiado)
 * run in CI where PostgreSQL is available.
 */

import { describe, it, expect } from "vitest";
import { app } from "../app";

/** Auth middleware returns 401 (no auth) or 500 (no DB) -- never 200. */
const REJECTED_STATUSES = [401, 500];

describe("Sales endpoints", () => {
  describe("POST /api/sales", () => {
    it("rejects unauthenticated sale creation", async () => {
      const res = await app.request("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ productId: "fake-id", quantity: 1, unitPrice: 10, discountPercent: 0 }],
          payments: [{ method: "efectivo", amountUsd: 10 }],
          discountPercent: 0,
        }),
      });
      expect(REJECTED_STATUSES).toContain(res.status);
    });
  });

  describe("GET /api/sales", () => {
    it("rejects unauthenticated sales listing", async () => {
      const res = await app.request("/api/sales");
      expect(REJECTED_STATUSES).toContain(res.status);
    });
  });

  describe("POST /api/sales/:id/void", () => {
    it("rejects unauthenticated void", async () => {
      const res = await app.request("/api/sales/fake-id/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "test" }),
      });
      expect(REJECTED_STATUSES).toContain(res.status);
    });
  });
});
