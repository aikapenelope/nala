/**
 * Drizzle ORM schema for Nova.
 *
 * Phase 0: businesses and users tables only.
 * Additional tables will be added in subsequent phases.
 */

import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
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
 */
export const users = pgTable("users", {
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
