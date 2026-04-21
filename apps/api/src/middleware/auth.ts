/**
 * Authentication middleware.
 *
 * Verifies Clerk JWT tokens and resolves the authenticated user.
 *
 * Every user (owner or employee) has their own Clerk account and JWT.
 * The middleware verifies the JWT, looks up the user by clerkId,
 * and sets the user context for downstream handlers.
 *
 * After auth, sets `user`, `businessId`, and `db` on the Hono context.
 */

import { verifyToken } from "@clerk/backend";
import { findUserByClerkId, findBusinessById } from "@nova/db";
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
 * 1. Verify Clerk JWT
 * 2. Look up user by clerkId (owner or employee)
 * 3. Set the resolved user on the context
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

  // --- Verify Clerk JWT ---

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authorization header required" }, 401);
  }

  const token = authHeader.slice(7);
  const clerkUserId = await verifyClerkJwt(token);

  if (!clerkUserId) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // Look up the user (owner or employee) by their Clerk ID
  const user = await findUserByClerkId(db, clerkUserId);

  if (!user) {
    return c.json(
      {
        error: "User not found. Complete onboarding first.",
        code: "USER_NOT_FOUND",
      },
      404,
    );
  }

  if (!user.isActive) {
    return c.json({ error: "Account is deactivated" }, 403);
  }

  const business = await findBusinessById(db, user.businessId);
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

  const activeUser: AuthUser = {
    id: user.id,
    businessId: user.businessId,
    businessName: business.name,
    name: user.name,
    role: user.role as "owner" | "employee",
    clerkId: clerkUserId,
  };

  c.set("user", activeUser);
  c.set("businessId", activeUser.businessId);

  await next();
}
