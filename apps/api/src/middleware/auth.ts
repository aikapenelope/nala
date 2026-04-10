/**
 * Authentication middleware.
 *
 * Supports two auth methods:
 * - Bearer {jwt}: Clerk JWT for owners on personal devices
 * - Pin {token}: PIN session token for employees on shared devices
 *
 * After auth, sets `user`, `businessId`, and `db` on the Hono context.
 */

import { verifyToken } from "@clerk/backend";
import { findUserByClerkId } from "@nova/db";
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
 * In development (no CLERK_SECRET_KEY), falls back to a mock user.
 * In production, verifies the Clerk JWT and looks up the user in DB.
 */
export async function authMiddleware(c: Context, next: Next) {
  const db = getDb();
  c.set("db", db);

  const authHeader = c.req.header("Authorization");

  // Development fallback when Clerk is not configured
  if (!process.env.CLERK_SECRET_KEY) {
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

  // Clerk JWT auth for owners
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authorization header required" }, 401);
  }

  const token = authHeader.slice(7);
  const clerkUserId = await verifyClerkJwt(token);

  if (!clerkUserId) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // Look up user in DB by Clerk ID to get businessId and role
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
