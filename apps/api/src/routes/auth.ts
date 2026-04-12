/**
 * Authentication routes (protected).
 *
 * POST /api/verify-owner-pin - Verify owner PIN for restricted actions.
 *   Mounted under /api (protected by authMiddleware) in app.ts.
 *   The businessId comes from the authenticated session context.
 *
 * The old public endpoints (POST /auth/pin, GET /auth/employees) have been
 * removed as part of the auth refactor (AUTH-REFACTOR-PLAN.md Sprint C).
 * PIN verification now happens locally on the frontend against a cached
 * team roster. See useTeamRoster.ts and GET /api/team-roster.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { PIN_LENGTH } from "@nova/shared";
import { users } from "@nova/db";
import type { AppEnv } from "../types";

// ============================================================
// Protected owner PIN verification (mounted under /api in app.ts)
// ============================================================

/** Schema for owner PIN verification (restricted actions). */
const ownerPinSchema = z.object({
  pin: z.string().length(PIN_LENGTH),
});

/**
 * Hono sub-app for owner PIN verification.
 *
 * This is a protected route that requires an active session.
 * The businessId comes from the authenticated user's context,
 * not from a client-supplied header (prevents spoofing).
 */
export const ownerPinRoute = new Hono<AppEnv>();

/**
 * POST /api/verify-owner-pin - Verify owner PIN for restricted actions.
 *
 * Used when an employee needs owner approval (void sale, large discount).
 * The businessId is taken from the authenticated session context.
 *
 * This is the server-side double-check. The frontend does a local bcrypt
 * check first for instant feedback, then calls this endpoint to confirm.
 */
ownerPinRoute.post(
  "/verify-owner-pin",
  zValidator("json", ownerPinSchema),
  async (c) => {
    const { pin } = c.req.valid("json");
    const businessId = c.get("businessId");
    const db = c.get("db");

    // Find active owners for this business
    const owners = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.businessId, businessId),
          eq(users.role, "owner"),
          eq(users.isActive, true),
        ),
      );

    if (owners.length === 0) {
      return c.json({ error: "No owner found for this business" }, 404);
    }

    for (const owner of owners) {
      const match = await bcrypt.compare(pin, owner.pinHash);
      if (match) {
        return c.json({ verified: true, ownerId: owner.id });
      }
    }

    return c.json({ error: "PIN de dueño incorrecto", verified: false }, 401);
  },
);
