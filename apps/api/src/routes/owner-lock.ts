/**
 * Owner Lock API routes.
 *
 * Provides a 4-digit PIN that locks sensitive sections of the app
 * (costs, reports, settings, accounting). Inspired by Loyverse/Square
 * POS passcode patterns.
 *
 * The PIN is optional. When not set, all sections are visible.
 * When set, the frontend shows a lock overlay on sensitive sections
 * until the correct PIN is entered.
 *
 * Security model:
 * - PIN is hashed with bcrypt (same library already in use)
 * - Verification is server-side (PIN never stored on client)
 * - Rate limited to prevent brute force (5 attempts/minute)
 * - Unlock state is client-side only (in-memory, not persisted)
 *
 * GET    /owner-lock/status  - Check if lock is enabled
 * POST   /owner-lock/setup   - Create or change PIN
 * POST   /owner-lock/verify  - Verify PIN (returns true/false)
 * DELETE /owner-lock/setup   - Disable lock (requires current PIN)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { businesses } from "@nova/db";
import bcrypt from "bcryptjs";
import { pinVerifyRateLimit } from "../middleware/rate-limit";
import type { AppEnv } from "../types";

const ownerLock = new Hono<AppEnv>();

/** PIN must be exactly 4 digits. */
const pinSchema = z
  .string()
  .length(4, "La clave debe ser de 4 digitos")
  .regex(/^\d{4}$/, "La clave debe ser de 4 digitos");

const BCRYPT_ROUNDS = 10;

/**
 * GET /owner-lock/status - Check if the owner lock is enabled.
 *
 * Returns { enabled: boolean } without revealing the PIN hash.
 * Used by the frontend to decide whether to show lock overlays.
 */
ownerLock.get("/owner-lock/status", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const [business] = await db
    .select({ ownerPinHash: businesses.ownerPinHash })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  return c.json({ enabled: !!business?.ownerPinHash });
});

/**
 * POST /owner-lock/setup - Create or change the owner lock PIN.
 *
 * Body: { pin: "1234", currentPin?: "0000" }
 * - If no lock exists: sets the PIN (currentPin not required)
 * - If lock exists: requires currentPin to change
 */
const setupSchema = z.object({
  pin: pinSchema,
  currentPin: pinSchema.optional(),
});

ownerLock.post(
  "/owner-lock/setup",
  zValidator("json", setupSchema),
  async (c) => {
    const { pin, currentPin } = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    // Check if lock already exists
    const [business] = await db
      .select({ ownerPinHash: businesses.ownerPinHash })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (business?.ownerPinHash) {
      // Lock exists: require current PIN to change
      if (!currentPin) {
        return c.json(
          { error: "Debes ingresar la clave actual para cambiarla" },
          400,
        );
      }

      const isValid = await bcrypt.compare(currentPin, business.ownerPinHash);
      if (!isValid) {
        return c.json({ error: "Clave actual incorrecta" }, 403);
      }
    }

    // Hash and save the new PIN
    const hash = await bcrypt.hash(pin, BCRYPT_ROUNDS);

    await db
      .update(businesses)
      .set({ ownerPinHash: hash, updatedAt: new Date() })
      .where(eq(businesses.id, businessId));

    return c.json({ success: true, enabled: true });
  },
);

/**
 * POST /owner-lock/verify - Verify the owner lock PIN.
 *
 * Body: { pin: "1234" }
 * Returns: { valid: true } or { valid: false, error: "..." }
 *
 * The frontend uses this to unlock sensitive sections temporarily.
 */
const verifySchema = z.object({
  pin: pinSchema,
});

ownerLock.post(
  "/owner-lock/verify",
  pinVerifyRateLimit,
  zValidator("json", verifySchema),
  async (c) => {
    const { pin } = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const [business] = await db
      .select({ ownerPinHash: businesses.ownerPinHash })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business?.ownerPinHash) {
      // Lock not enabled: always valid
      return c.json({ valid: true });
    }

    const isValid = await bcrypt.compare(pin, business.ownerPinHash);

    if (!isValid) {
      return c.json({ valid: false, error: "Clave incorrecta" }, 401);
    }

    return c.json({ valid: true });
  },
);

/**
 * DELETE /owner-lock/setup - Disable the owner lock.
 *
 * Body: { pin: "1234" } (current PIN required to disable)
 */
ownerLock.delete(
  "/owner-lock/setup",
  zValidator("json", verifySchema),
  async (c) => {
    const { pin } = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const [business] = await db
      .select({ ownerPinHash: businesses.ownerPinHash })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!business?.ownerPinHash) {
      return c.json({ success: true, enabled: false });
    }

    const isValid = await bcrypt.compare(pin, business.ownerPinHash);
    if (!isValid) {
      return c.json({ error: "Clave incorrecta" }, 403);
    }

    await db
      .update(businesses)
      .set({ ownerPinHash: null, updatedAt: new Date() })
      .where(eq(businesses.id, businessId));

    return c.json({ success: true, enabled: false });
  },
);

export { ownerLock };
