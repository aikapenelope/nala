/**
 * Authentication routes.
 *
 * Public (no auth middleware):
 *   POST /auth/pin       - Verify employee PIN on shared device
 *   GET  /auth/employees - List employees for PIN screen shortcuts
 *
 * Note: verify-owner-pin is mounted under /api (protected) in app.ts
 * because it requires an active authenticated session.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import {
  PIN_LENGTH,
  MAX_PIN_ATTEMPTS,
  PIN_LOCKOUT_MINUTES,
} from "@nova/shared";
import { users } from "@nova/db";
import { getDb } from "../db";
import type { AuthUser } from "../middleware/auth";
import type { AppEnv } from "../types";

/** Public auth routes (no auth middleware required). */
const auth = new Hono();

/** Schema for PIN verification request. */
const pinSchema = z.object({
  businessId: z.string().uuid(),
  pin: z.string().length(PIN_LENGTH),
});

/**
 * POST /auth/pin - Verify employee PIN.
 *
 * Flow:
 * 1. Find all active, non-locked users for the business
 * 2. Compare PIN hash against each user (bcrypt)
 * 3. If match: return user info, reset failed attempts
 * 4. If no match: we don't know which user tried, so we don't
 *    increment any specific user's failed attempts. The lockout
 *    logic is per-user and only applies when we can identify the user.
 *
 * Security note: We iterate all users because PINs are short (4 digits)
 * and we can't know which user is attempting. In production with many
 * employees, consider requiring user selection before PIN entry.
 */
auth.post("/pin", zValidator("json", pinSchema), async (c) => {
  const { businessId, pin } = c.req.valid("json");
  const db = getDb();

  // Find active users for this business
  const businessUsers = await db
    .select()
    .from(users)
    .where(and(eq(users.businessId, businessId), eq(users.isActive, true)));

  if (businessUsers.length === 0) {
    return c.json({ error: "No users found for this business" }, 404);
  }

  // Filter out locked users
  const now = new Date();
  const availableUsers = businessUsers.filter(
    (u) => !u.pinLockedUntil || new Date(u.pinLockedUntil) <= now,
  );

  if (availableUsers.length === 0) {
    return c.json(
      {
        error: "Todos los usuarios están bloqueados. Espera 5 minutos.",
        locked: true,
        lockoutMinutes: PIN_LOCKOUT_MINUTES,
      },
      429,
    );
  }

  // Try each available user's PIN hash
  for (const user of availableUsers) {
    const match = await bcrypt.compare(pin, user.pinHash);

    if (match) {
      // Reset failed attempts on successful login
      if (user.pinFailedAttempts > 0) {
        await db
          .update(users)
          .set({
            pinFailedAttempts: 0,
            pinLockedUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
      }

      const authUser: AuthUser = {
        id: user.id,
        businessId: user.businessId,
        name: user.name,
        role: user.role as "owner" | "employee",
        clerkId: user.clerkId ?? undefined,
      };

      return c.json({ user: authUser });
    }
  }

  // No match found.
  // Since we can't identify which user attempted, we track failed attempts
  // at the business level using a simple heuristic: increment the user with
  // the lowest failed attempts (spreads the count evenly).
  const leastFailed = availableUsers.reduce((min, u) =>
    u.pinFailedAttempts < min.pinFailedAttempts ? u : min,
  );

  const newAttempts = leastFailed.pinFailedAttempts + 1;
  const lockUntil =
    newAttempts >= MAX_PIN_ATTEMPTS
      ? new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60 * 1000)
      : null;

  await db
    .update(users)
    .set({
      pinFailedAttempts: newAttempts,
      pinLockedUntil: lockUntil,
      updatedAt: new Date(),
    })
    .where(eq(users.id, leastFailed.id));

  if (lockUntil) {
    return c.json(
      {
        error: "Demasiados intentos. Espera 5 minutos.",
        locked: true,
        lockoutMinutes: PIN_LOCKOUT_MINUTES,
      },
      429,
    );
  }

  return c.json({ error: "PIN incorrecto" }, 401);
});

/**
 * GET /auth/employees - List employee names for PIN screen shortcuts.
 *
 * Returns only names and roles (no PINs, no sensitive data).
 * Used by the PIN screen to show quick-select buttons.
 */
auth.get("/employees", async (c) => {
  const businessId = c.req.query("businessId");

  if (!businessId) {
    return c.json({ employees: [] });
  }

  const db = getDb();

  const employees = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.businessId, businessId), eq(users.isActive, true)));

  return c.json({ employees });
});

export { auth };

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
