/**
 * Drizzle ORM schema for Nova.
 *
 * Phase 1: businesses, users, and activity_log tables.
 * RLS policies are applied via init.sql (not Drizzle).
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Businesses table - each row is a tenant.
 * All other tables reference this via business_id for RLS isolation.
 */
export const businesses = pgTable("businesses", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("otro"),
  phone: text("phone"),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Users table - owners (Clerk auth) and employees (PIN auth).
 * Each user belongs to exactly one business.
 *
 * Auth flow:
 * - Owner: Clerk login (email+password) → clerk_id links to this table
 * - Employee: PIN on shared device → pin_hash verified by backend
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    clerkId: text("clerk_id"),
    name: text("name").notNull(),
    role: text("role").notNull().default("employee"),
    pinHash: text("pin_hash").notNull(),
    phone: text("phone"),
    whatsappEnabled: boolean("whatsapp_enabled").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),

    /** Failed PIN attempts counter. Resets on successful login. */
    pinFailedAttempts: integer("pin_failed_attempts").notNull().default(0),

    /** Timestamp when PIN lockout expires. Null = not locked. */
    pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_users_clerk_id").on(table.clerkId),
    uniqueIndex("idx_users_phone").on(table.phone),
  ],
);

/**
 * Activity log - tracks all user actions for accountability.
 * Every sale, price change, login, etc. is recorded here.
 */
export const activityLog = pgTable("activity_log", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  detail: text("detail"),
  channel: text("channel").notNull().default("web"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
