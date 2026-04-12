/**
 * Team management routes.
 *
 * GET  /team-roster   - Download employee list with PIN hashes for local cache (owner only)
 * POST /switch-user   - Server-side user switch validation (fallback when no local roster)
 *
 * These endpoints support the "Clerk authenticates device, PIN identifies user"
 * pattern from AUTH-REFACTOR-PLAN.md.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { users } from "@nova/db";
import type { AppEnv } from "../types";

const team = new Hono<AppEnv>();

/**
 * GET /team-roster - Download employee roster for local PIN verification.
 *
 * Returns all active users for the business with their PIN hashes.
 * The frontend caches this roster and verifies PINs locally (no API call
 * needed for daily PIN entry).
 *
 * Security:
 * - Protected by JWT (authMiddleware)
 * - Only owners can download the roster (employees don't need it)
 * - PIN hashes are bcrypt with salt, resistant to offline brute force
 * - The roster is useless without a valid JWT to make API calls
 */
team.get("/team-roster", async (c) => {
  const currentUser = c.get("user");
  const db = c.get("db");

  // Only owners can download the roster
  if (currentUser.role !== "owner") {
    return c.json(
      { error: "Only the business owner can access the roster" },
      403,
    );
  }

  const roster = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      pinHash: users.pinHash,
    })
    .from(users)
    .where(
      and(
        eq(users.businessId, currentUser.businessId),
        eq(users.isActive, true),
      ),
    );

  return c.json({
    roster,
    businessId: currentUser.businessId,
    businessName: currentUser.businessName,
    // Timestamp so the frontend knows when to refresh
    generatedAt: new Date().toISOString(),
  });
});

/**
 * POST /switch-user - Server-side user switch (fallback).
 *
 * Used when the frontend doesn't have a cached roster (first load,
 * cache cleared, etc.). Validates that the requested user belongs
 * to the same business as the JWT owner.
 *
 * In normal operation, the frontend verifies PINs locally and only
 * sends X-Acting-As headers. This endpoint is the fallback.
 */
const switchUserSchema = z.object({
  userId: z.string().uuid(),
});

team.post("/switch-user", zValidator("json", switchUserSchema), async (c) => {
  const { userId } = c.req.valid("json");
  const currentUser = c.get("user");
  const db = c.get("db");

  // Look up the target user and validate same business
  const [targetUser] = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      businessId: users.businessId,
    })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.businessId, currentUser.businessId),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  if (!targetUser) {
    return c.json({ error: "User not found or not in this business" }, 404);
  }

  return c.json({
    user: {
      id: targetUser.id,
      name: targetUser.name,
      role: targetUser.role,
      businessId: targetUser.businessId,
      businessName: currentUser.businessName,
    },
  });
});

export { team };
