/**
 * Authentication middleware.
 *
 * Supports two auth methods:
 * - Bearer {jwt}: Clerk JWT for owners on personal devices
 * - Pin {business_id}:{pin}: PIN for employees on shared devices (Sprint 1.3)
 *
 * After auth, sets `user` and `businessId` on the Hono context.
 */

import { verifyToken } from "@clerk/backend";
import type { Context, Next } from "hono";

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
 * In production, verifies the Clerk JWT from the Authorization header.
 */
export async function authMiddleware(c: Context, next: Next) {
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

  // PIN auth for employees on shared devices (Sprint 1.3)
  if (authHeader?.startsWith("Pin ")) {
    // Will be implemented in Sprint 1.3
    return c.json({ error: "PIN auth not yet implemented" }, 501);
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

  // TODO (Sprint 1.2): Look up user in DB by clerk_id to get businessId and role
  // For now, set a placeholder that will be replaced when DB is connected
  const user: AuthUser = {
    id: clerkUserId,
    businessId: "pending-db-lookup",
    name: "Clerk User",
    role: "owner",
    clerkId: clerkUserId,
  };

  c.set("user", user);
  c.set("businessId", user.businessId);

  await next();
}
