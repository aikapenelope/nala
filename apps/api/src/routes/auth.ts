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
import {
  users,
  incrementPinFailedAttempts,
  resetPinFailedAttempts,
} from "@nova/db";
import type { AppEnv } from "../types";

// ============================================================
// Protected owner PIN verification (mounted under /api in app.ts)
// ============================================================

/** Maximum failed PIN attempts before lockout. */
const MAX_PIN_ATTEMPTS = 5;

/** Lockout duration in minutes after exceeding max attempts. */
const LOCKOUT_MINUTES = 15;

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
 * Implements PIN lockout: after 5 failed attempts, the owner account is
 * locked for 15 minutes. Successful verification resets the counter.
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

    // Check if any owner is currently locked out
    const now = new Date();
    const allLocked = owners.every(
      (o) => o.pinLockedUntil && o.pinLockedUntil > now,
    );
    if (allLocked) {
      const earliest = owners.reduce((min, o) => {
        const lockEnd = o.pinLockedUntil?.getTime() ?? 0;
        return lockEnd < min ? lockEnd : min;
      }, Infinity);
      const minutesLeft = Math.ceil((earliest - now.getTime()) / 60_000);
      return c.json(
        {
          error: `PIN bloqueado por ${minutesLeft} minuto(s). Intenta mas tarde.`,
          verified: false,
          locked: true,
        },
        429,
      );
    }

    // Try to match PIN against non-locked owners
    for (const owner of owners) {
      // Skip locked owners
      if (owner.pinLockedUntil && owner.pinLockedUntil > now) continue;

      const match = await bcrypt.compare(pin, owner.pinHash);
      if (match) {
        // Reset failed attempts on success
        await resetPinFailedAttempts(db, owner.id);
        return c.json({ verified: true, ownerId: owner.id });
      }
    }

    // PIN didn't match any owner -- increment failed attempts for all non-locked owners
    for (const owner of owners) {
      if (owner.pinLockedUntil && owner.pinLockedUntil > now) continue;

      const newAttempts = owner.pinFailedAttempts + 1;
      const lockUntil =
        newAttempts >= MAX_PIN_ATTEMPTS
          ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000)
          : undefined;

      await incrementPinFailedAttempts(db, owner.id, lockUntil);
    }

    return c.json({ error: "PIN de dueño incorrecto", verified: false }, 401);
  },
);
