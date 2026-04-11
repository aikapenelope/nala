/**
 * Database query helpers for common operations.
 *
 * These functions are used by the API middleware and routes
 * to look up users, businesses, and verify PINs.
 */

import { eq, and, sql } from "drizzle-orm";
import type { Database } from "./client";
import { users, businesses } from "./schema";

/** Find a user by their Clerk ID (for owner login). */
export async function findUserByClerkId(db: Database, clerkId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return result[0] ?? null;
}

/** Find all active users for a business (for PIN verification). */
export async function findActiveUsersByBusiness(
  db: Database,
  businessId: string,
) {
  return db
    .select()
    .from(users)
    .where(and(eq(users.businessId, businessId), eq(users.isActive, true)));
}

/** Find a business by ID. */
export async function findBusinessById(db: Database, businessId: string) {
  const result = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  return result[0] ?? null;
}

/** Increment failed PIN attempts for a user. */
export async function incrementPinFailedAttempts(
  db: Database,
  userId: string,
  lockUntil?: Date,
) {
  await db
    .update(users)
    .set({
      pinFailedAttempts: sql`${users.pinFailedAttempts} + 1`,
      pinLockedUntil: lockUntil ?? null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/** Reset PIN failed attempts after successful login. */
export async function resetPinFailedAttempts(db: Database, userId: string) {
  await db
    .update(users)
    .set({
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
