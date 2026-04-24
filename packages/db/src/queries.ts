/**
 * Database query helpers for common operations.
 *
 * These functions are used by the API middleware and routes
 * to look up users and businesses.
 */

import { eq } from "drizzle-orm";
import type { Database } from "./client";
import { users, businesses } from "./schema";

/** Find a user by their Clerk ID (for auth middleware). */
export async function findUserByClerkId(db: Database, clerkId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return result[0] ?? null;
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
