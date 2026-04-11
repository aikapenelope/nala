/**
 * Authentication middleware.
 *
 * Verifies Clerk JWT tokens and looks up the user in the database
 * to populate the request context with user info and businessId.
 *
 * In development mode (NODE_ENV=development without CLERK_SECRET_KEY),
 * uses a dev-only mock user. This is gated behind an explicit env check
 * so it cannot accidentally run in production.
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
 * Production: verifies Clerk JWT, looks up user in DB, validates business exists.
 * Development: allows a mock user ONLY when NODE_ENV=development AND CLERK_SECRET_KEY is not set.
 */
export async function authMiddleware(c: Context, next: Next) {
  const db = getDb();
  c.set("db", db);

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;

  // Development-only mock user.
  // Requires BOTH conditions: NODE_ENV=development AND no CLERK_SECRET_KEY.
  // In production, config.ts already exits if CLERK_SECRET_KEY is missing,
  // so this branch is unreachable in production.
  if (!clerkSecretKey && process.env.NODE_ENV === "development") {
    c.set("user", {
      id: "dev-user-001",
      businessId: "dev-business-001",
      name: "Dev User",
      role: "owner",
      clerkId: "dev-clerk-001",
    } satisfies AuthUser);
    c.set("businessId", "dev-business-001");
    await next();
    return;
  }

  // If we get here without CLERK_SECRET_KEY, something is wrong.
  if (!clerkSecretKey) {
    return c.json(
      {
        error: "Server misconfiguration: authentication not available",
      },
      500,
    );
  }

  // Require Authorization header
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authorization header required" }, 401);
  }

  const token = authHeader.slice(7);
  const clerkUserId = await verifyClerkJwt(token);

  if (!clerkUserId) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // Look up user in DB by Clerk ID
  const dbUser = await findUserByClerkId(db, clerkUserId);

  if (!dbUser) {
    return c.json(
      {
        error: "User not found. Complete onboarding first.",
        code: "USER_NOT_FOUND",
      },
      404,
    );
  }

  if (!dbUser.isActive) {
    return c.json({ error: "Account is deactivated" }, 403);
  }

  // Validate that the business actually exists in the database.
  // This prevents stale businessId references from causing silent failures.
  const business = await findBusinessById(db, dbUser.businessId);
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

  const user: AuthUser = {
    id: dbUser.id,
    businessId: dbUser.businessId,
    name: dbUser.name,
    role: dbUser.role as "owner" | "employee",
    clerkId: clerkUserId,
  };

  c.set("user", user);
  c.set("businessId", user.businessId);

  await next();
}
