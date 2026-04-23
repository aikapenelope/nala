/**
 * Authentication middleware.
 *
 * Verifies Clerk JWT tokens and resolves the authenticated user.
 *
 * Every user (owner or employee) has their own Clerk account and JWT.
 * The middleware verifies the JWT, looks up the user by clerkId,
 * and sets the user context for downstream handlers.
 *
 * For invited employees: when they first sign in after accepting the
 * invitation, their clerkId is not yet in the DB. The middleware uses
 * two strategies to link the employee:
 *   1. Read Clerk's publicMetadata.novaUserId (set during invitation)
 *   2. Fall back to matching by email within the same business
 *
 * A Clerk webhook (POST /webhooks/clerk) also handles this linking
 * asynchronously. The on-the-fly linking here is a synchronous fallback
 * for when the webhook hasn't arrived yet.
 *
 * After auth, sets `user`, `businessId`, and `db` on the Hono context.
 */

import { verifyToken, createClerkClient } from "@clerk/backend";
import { findUserByClerkId, findBusinessById } from "@nova/db";
import { eq, and, isNull } from "drizzle-orm";
import { users } from "@nova/db";
import type { Context, Next } from "hono";
import { getDb } from "../db";
import type { Database } from "@nova/db";

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
 * Attempt to link a Clerk user to an existing Nova employee record.
 *
 * Strategy 1: Use publicMetadata.novaUserId from the Clerk invitation.
 * Strategy 2: Match by email within the business from publicMetadata.
 *
 * Returns the linked user record, or null if linking failed.
 */
/** Inferred row type from the users table. */
type UserRow = typeof users.$inferSelect;

async function tryLinkEmployee(
  db: Database,
  clerkUserId: string,
  clerkSecretKey: string,
): Promise<UserRow | null> {
  try {
    const clerk = createClerkClient({ secretKey: clerkSecretKey });
    const clerkUser = await clerk.users.getUser(clerkUserId);
    const meta = clerkUser.publicMetadata as {
      novaUserId?: string;
      businessId?: string;
      role?: string;
    };

    // Strategy 1: Link by novaUserId from invitation metadata
    if (meta.novaUserId) {
      const [linked] = await db
        .update(users)
        .set({ clerkId: clerkUserId, updatedAt: new Date() })
        .where(
          and(eq(users.id, meta.novaUserId), isNull(users.clerkId)),
        )
        .returning();

      if (linked) {
        console.info(
          `[auth] Linked clerkId ${clerkUserId} to employee ${meta.novaUserId} (via metadata).`,
        );
        return linked;
      }

      // novaUserId was set but the record wasn't found or already linked.
      // Check if it was already linked by the webhook.
      const [alreadyLinked] = await db
        .select()
        .from(users)
        .where(eq(users.id, meta.novaUserId))
        .limit(1);

      if (alreadyLinked?.clerkId === clerkUserId) {
        console.info(
          `[auth] Employee ${meta.novaUserId} already linked to ${clerkUserId} (by webhook).`,
        );
        return alreadyLinked;
      }
    }

    // Strategy 2: Match by email within the business
    // This handles cases where publicMetadata didn't propagate novaUserId
    // but does have businessId, or where the invitation metadata was partial.
    if (meta.businessId) {
      const primaryEmail = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress;

      if (primaryEmail) {
        console.info(
          `[auth] Attempting email-based linking for ${primaryEmail} in business ${meta.businessId}.`,
        );

        // Look for an unlinked employee in this business.
        // We don't match by email in the DB (employees don't store email),
        // but we can match by businessId + no clerkId + role=employee.
        // This is a best-effort fallback for single pending invitations.
        const unlinkedEmployees = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.businessId, meta.businessId),
              eq(users.role, "employee"),
              eq(users.isActive, true),
              isNull(users.clerkId),
            ),
          );

        if (unlinkedEmployees.length === 1) {
          // Only one unlinked employee -- safe to link
          const [linked] = await db
            .update(users)
            .set({ clerkId: clerkUserId, updatedAt: new Date() })
            .where(eq(users.id, unlinkedEmployees[0].id))
            .returning();

          if (linked) {
            console.info(
              `[auth] Linked clerkId ${clerkUserId} to employee ${linked.id} (via single-unlinked fallback).`,
            );
            return linked;
          }
        } else if (unlinkedEmployees.length > 1) {
          console.warn(
            `[auth] Multiple unlinked employees in business ${meta.businessId}. ` +
              `Cannot auto-link by email. Waiting for webhook or retry.`,
          );
        }
      }
    }

    return null;
  } catch (err) {
    console.error("[auth] Employee linking failed:", err);
    return null;
  }
}

/**
 * Auth middleware for protected API routes.
 *
 * 1. Verify Clerk JWT
 * 2. Look up user by clerkId (owner or employee)
 * 3. If not found, attempt on-the-fly employee linking
 * 4. Set the resolved user on the context
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
  let user: UserRow | null = await findUserByClerkId(db, clerkUserId);

  // --- Employee linking: first login after accepting invitation ---
  if (!user) {
    user = await tryLinkEmployee(db, clerkUserId, clerkSecretKey);
  }

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
