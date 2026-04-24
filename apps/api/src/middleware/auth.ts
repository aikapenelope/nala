/**
 * Authentication middleware.
 *
 * Verifies Clerk JWT tokens and resolves the authenticated user.
 *
 * Simple single-admin flow (no Organizations required):
 * 1. Verify the Clerk JWT
 * 2. Look up the user by clerkId in the DB
 * 3. Find their business
 * 4. Set user, businessId, and db on the Hono context
 *
 * If the user doesn't exist yet (first login after sign-up),
 * the /api/me endpoint returns a signal so the frontend redirects
 * to onboarding.
 */

import { verifyToken } from "@clerk/backend";
import {
  findUserByClerkId,
  findBusinessById,
} from "@nova/db";
import type { Context, Next } from "hono";
import { getDb } from "../db";

export interface AuthUser {
  id: string;
  businessId: string;
  businessName: string;
  name: string;
  role: "owner" | "employee";
  clerkId: string;
}

/**
 * Verify a Clerk JWT and return the subject (user ID).
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
 * 2. Look up user by clerkId
 * 3. Find their business
 * 4. Set context variables
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

  // --- Look up the user by Clerk ID ---
  const user = await findUserByClerkId(db, clerkUserId);

  if (!user) {
    // User exists in Clerk but not in our DB yet.
    // This happens after sign-up before onboarding.
    // Return a specific code so the frontend knows to redirect to onboarding.
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

  // --- Look up the business ---
  const business = await findBusinessById(db, user.businessId);

  if (!business) {
    return c.json(
      {
        error: "Business not found.",
        code: "BUSINESS_NOT_FOUND",
      },
      404,
    );
  }

  if (!business.isActive) {
    return c.json({ error: "Business is deactivated" }, 403);
  }

  const activeUser: AuthUser = {
    id: user.id,
    businessId: business.id,
    businessName: business.name,
    name: user.name,
    role: user.role as "owner" | "employee",
    clerkId: clerkUserId,
  };

  c.set("user", activeUser);
  c.set("businessId", business.id);

  await next();
}
