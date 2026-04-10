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
import { PIN_LENGTH, MAX_PIN_ATTEMPTS, PIN_LOCKOUT_MINUTES } from "@nova/shared";

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

  // TODO: When DB is connected:
  // 1. Find active users for businessId
  // 2. For each user, compare bcrypt(pin, user.pinHash)
  // 3. Handle lockout logic (pinFailedAttempts >= MAX_PIN_ATTEMPTS)
  // 4. Return user info on success

  // Placeholder response
  return c.json(
    {
      error: "PIN verification requires database connection",
      hint: "Run docker compose up and configure DATABASE_URL",
    },
    503,
  );
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
    // TODO: Verify the owner's PIN for the current business
    return c.json(
      {
        error: "Owner PIN verification requires database connection",
      },
      503,
    );
  },
);

/**
 * GET /auth/employees - List employee names for PIN screen shortcuts.
 *
 * Returns only names (no PINs, no sensitive data).
 * Used by the PIN screen to show quick-select buttons.
 */
auth.get("/employees", async (c) => {
  // TODO: Query active employees for the business from auth context
  return c.json({ employees: [] });
});

export { auth };
