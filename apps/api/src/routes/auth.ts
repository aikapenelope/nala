/**
 * Authentication routes.
 *
 * POST /auth/pin       - Verify employee PIN on shared device
 * POST /auth/verify-owner-pin - Verify owner PIN for restricted actions
 * GET  /auth/employees - List employees for PIN screen shortcuts
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
 * 1. Find all active users for the business
 * 2. Compare PIN hash against each user
 * 3. If match: return user info, reset failed attempts
 * 4. If no match: increment failed attempts, lock after MAX_PIN_ATTEMPTS
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

  // Try each user's PIN hash
  for (const user of businessUsers) {
    // Check lockout
    if (user.pinLockedUntil && new Date(user.pinLockedUntil) > new Date()) {
      continue; // Skip locked users
    }

    const match = await bcrypt.compare(pin, user.pinHash);

    if (match) {
      // Reset failed attempts on success
      await db
        .update(users)
        .set({
          pinFailedAttempts: 0,
          pinLockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

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

  // No match found - increment failed attempts for all non-locked users
  for (const user of businessUsers) {
    if (user.pinLockedUntil && new Date(user.pinLockedUntil) > new Date()) {
      continue;
    }

    const newAttempts = user.pinFailedAttempts + 1;
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
      .where(eq(users.id, user.id));
  }

  // Check if all users are now locked
  const anyLocked = businessUsers.some(
    (u) =>
      u.pinFailedAttempts + 1 >= MAX_PIN_ATTEMPTS ||
      (u.pinLockedUntil && new Date(u.pinLockedUntil) > new Date()),
  );

  if (anyLocked) {
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

/** Schema for owner PIN verification (restricted actions). */
const ownerPinSchema = z.object({
  pin: z.string().length(PIN_LENGTH),
});

/**
 * POST /auth/verify-owner-pin - Verify owner PIN for restricted actions.
 *
 * Used when an employee needs owner approval (void sale, large discount).
 * Requires an active session (auth middleware must have run).
 */
auth.post(
  "/verify-owner-pin",
  zValidator("json", ownerPinSchema),
  async (c) => {
    const { pin } = c.req.valid("json");
    const businessId = c.req.header("X-Business-Id");

    if (!businessId) {
      return c.json({ error: "Business ID required" }, 400);
    }

    const db = getDb();

    // Find the owner for this business
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

    for (const owner of owners) {
      const match = await bcrypt.compare(pin, owner.pinHash);
      if (match) {
        return c.json({ verified: true, ownerId: owner.id });
      }
    }

    return c.json({ error: "PIN de dueño incorrecto", verified: false }, 401);
  },
);

/**
 * GET /auth/employees - List employee names for PIN screen shortcuts.
 *
 * Returns only names (no PINs, no sensitive data).
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
