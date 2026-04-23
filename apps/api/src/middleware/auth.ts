/**
 * Authentication middleware.
 *
 * Verifies Clerk JWT tokens and resolves the authenticated user.
 *
 * Uses Clerk Organizations for multi-tenancy:
 * - The JWT contains `orgId` (the Clerk Organization ID) and `orgRole`
 * - The middleware looks up the business by `clerkOrgId` in the DB
 * - The user is looked up by `clerkId` within that business
 * - If the user doesn't exist yet (first login after accepting org invite),
 *   the middleware creates the user record automatically
 *
 * No custom linking, no webhooks, no retry loops. Clerk handles everything.
 *
 * After auth, sets `user`, `businessId`, and `db` on the Hono context.
 */

import { verifyToken } from "@clerk/backend";
import {
  findBusinessByClerkOrgId,
  findUserInBusiness,
} from "@nova/db";
import { users } from "@nova/db";
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
 * Decoded Clerk JWT payload (subset we use).
 */
interface ClerkJwtPayload {
  sub: string;
  org_id?: string;
  org_role?: string;
  org_slug?: string;
}

/**
 * Verify a Clerk JWT and return the decoded payload.
 * Returns null if the token is invalid or expired.
 */
async function verifyClerkJwt(
  token: string,
): Promise<ClerkJwtPayload | null> {
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY ?? "",
    });
    return {
      sub: payload.sub ?? "",
      org_id: payload.org_id as string | undefined,
      org_role: payload.org_role as string | undefined,
      org_slug: payload.org_slug as string | undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Map Clerk org role to Nova role.
 * Clerk uses "org:admin" for admins and "org:member" for members.
 */
function mapOrgRole(orgRole: string | undefined): "owner" | "employee" {
  if (orgRole === "org:admin") return "owner";
  return "employee";
}

/**
 * Auth middleware for protected API routes.
 *
 * 1. Verify Clerk JWT
 * 2. Extract orgId from JWT (required -- user must have an active org)
 * 3. Look up business by clerkOrgId
 * 4. Look up or auto-create user in that business
 * 5. Set the resolved user on the context
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
  const payload = await verifyClerkJwt(token);

  if (!payload || !payload.sub) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const clerkUserId = payload.sub;
  const clerkOrgId = payload.org_id;
  const clerkOrgRole = payload.org_role;

  // --- Require an active Organization ---
  // Users must select an Organization before accessing the API.
  // This is enforced by Clerk's "choose-organization" session task.
  if (!clerkOrgId) {
    return c.json(
      {
        error: "No organization selected. Please select a business first.",
        code: "NO_ORGANIZATION",
      },
      403,
    );
  }

  // --- Look up the business by Clerk Organization ID ---
  const business = await findBusinessByClerkOrgId(db, clerkOrgId);

  if (!business) {
    return c.json(
      {
        error: "Business not found for this organization.",
        code: "BUSINESS_NOT_FOUND",
      },
      404,
    );
  }

  if (!business.isActive) {
    return c.json({ error: "Business is deactivated" }, 403);
  }

  // --- Look up or auto-create the user ---
  // When an employee accepts a Clerk Organization invitation and logs in
  // for the first time, they won't have a record in our `users` table yet.
  // We auto-create it based on the Clerk JWT data.
  let user = await findUserInBusiness(db, clerkUserId, business.id);

  if (!user) {
    // Auto-create user record for new org members.
    // The role comes from the Clerk Organization membership.
    const role = mapOrgRole(clerkOrgRole);

    try {
      const [created] = await db
        .insert(users)
        .values({
          businessId: business.id,
          clerkId: clerkUserId,
          name: clerkOrgRole === "org:admin" ? "Owner" : "Employee",
          role,
        })
        .returning();

      user = created;
      console.info(
        `[auth] Auto-created user ${created.id} (${role}) in business ${business.id} for clerkId ${clerkUserId}`,
      );
    } catch (err) {
      // If there's a unique constraint violation, the user was created
      // concurrently (race condition). Try to find them again.
      user = await findUserInBusiness(db, clerkUserId, business.id);
      if (!user) {
        console.error("[auth] Failed to create or find user:", err);
        return c.json({ error: "Failed to initialize user account" }, 500);
      }
    }
  }

  if (!user.isActive) {
    return c.json({ error: "Account is deactivated" }, 403);
  }

  // Use the Clerk org role as the source of truth for permissions.
  // This ensures role changes in Clerk Dashboard take effect immediately.
  const role = mapOrgRole(clerkOrgRole);

  const activeUser: AuthUser = {
    id: user.id,
    businessId: business.id,
    businessName: business.name,
    name: user.name,
    role,
    clerkId: clerkUserId,
  };

  c.set("user", activeUser);
  c.set("businessId", business.id);

  await next();
}
