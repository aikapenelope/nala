/**
 * Authentication middleware.
 *
 * Verifies Clerk JWT tokens and resolves the active user for the request.
 *
 * Two modes of operation:
 *
 * 1. **Owner direct** (no X-Acting-As header):
 *    JWT -> look up owner by clerkId -> set as active user.
 *
 * 2. **Employee acting** (X-Acting-As: <userId> header):
 *    JWT -> look up owner by clerkId (validates device auth) ->
 *    look up acting user by ID -> validate same business ->
 *    set acting user as active user.
 *
 * This implements the "Clerk authenticates the device, PIN identifies
 * the user" pattern from AUTH-REFACTOR-PLAN.md. The PIN verification
 * happens locally on the frontend; the backend only needs to know
 * which user is acting via the header.
 *
 * After auth, sets `user`, `businessId`, and `db` on the Hono context.
 */

import { verifyToken } from "@clerk/backend";
import { findUserByClerkId, findBusinessById } from "@nova/db";
import { eq, and } from "drizzle-orm";
import { users } from "@nova/db";
import type { Context, Next } from "hono";
import { getDb } from "../db";

export interface AuthUser {
  id: string;
  businessId: string;
  businessName: string;
  name: string;
  role: "owner" | "employee";
  clerkId?: string;
}

/**
 * Verify a Clerk JWT and return the authenticated user's Clerk ID.
 * Returns null if the token is invalid or expired.
 */
async function verifyClerkJwt(token: string): Promise<string | null> {
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY ?? "",
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Auth middleware for protected API routes.
 *
 * 1. Verify Clerk JWT -> identify the device owner
 * 2. If X-Acting-As header present -> resolve the acting employee
 * 3. Set the resolved user (owner or employee) on the context
 */
export async function authMiddleware(c: Context, next: Next) {
  const db = getDb();
  c.set("db", db);

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;

  // Development-only mock user.
  if (!clerkSecretKey && process.env.NODE_ENV === "development") {
    c.set("user", {
      id: "dev-user-001",
      businessId: "dev-business-001",
      businessName: "Dev Business",
      name: "Dev User",
      role: "owner",
      clerkId: "dev-clerk-001",
    } satisfies AuthUser);
    c.set("businessId", "dev-business-001");
    await next();
    return;
  }

  if (!clerkSecretKey) {
    return c.json(
      { error: "Server misconfiguration: authentication not available" },
      500,
    );
  }

  // --- Step 1: Verify Clerk JWT (device authentication) ---

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authorization header required" }, 401);
  }

  const token = authHeader.slice(7);
  const clerkUserId = await verifyClerkJwt(token);

  if (!clerkUserId) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // Look up the device owner (the Clerk account holder)
  const ownerUser = await findUserByClerkId(db, clerkUserId);

  if (!ownerUser) {
    return c.json(
      {
        error: "User not found. Complete onboarding first.",
        code: "USER_NOT_FOUND",
      },
      404,
    );
  }

  if (!ownerUser.isActive) {
    return c.json({ error: "Account is deactivated" }, 403);
  }

  const business = await findBusinessById(db, ownerUser.businessId);
  if (!business) {
    return c.json(
      {
        error: "Business not found. Account may be corrupted.",
        code: "BUSINESS_NOT_FOUND",
      },
      500,
    );
  }

  if (!business.isActive) {
    return c.json({ error: "Business is deactivated" }, 403);
  }

  // --- Step 2: Check for X-Acting-As (employee identification) ---

  const actingAsUserId = c.req.header("X-Acting-As");
  let activeUser: AuthUser;

  if (actingAsUserId && actingAsUserId !== ownerUser.id) {
    // An employee is acting on this device. Look them up and validate
    // they belong to the same business as the device owner.
    const [actingUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, actingAsUserId),
          eq(users.businessId, ownerUser.businessId),
          eq(users.isActive, true),
        ),
      )
      .limit(1);

    if (!actingUser) {
      return c.json(
        { error: "Acting user not found or not in this business" },
        403,
      );
    }

    activeUser = {
      id: actingUser.id,
      businessId: actingUser.businessId,
      businessName: business.name,
      name: actingUser.name,
      role: actingUser.role as "owner" | "employee",
      clerkId: actingUser.clerkId ?? undefined,
    };
  } else {
    // Owner is acting directly
    activeUser = {
      id: ownerUser.id,
      businessId: ownerUser.businessId,
      businessName: business.name,
      name: ownerUser.name,
      role: ownerUser.role as "owner" | "employee",
      clerkId: clerkUserId,
    };
  }

  c.set("user", activeUser);
  c.set("businessId", activeUser.businessId);

  await next();
}
