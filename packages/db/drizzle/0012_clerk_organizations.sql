-- Migration: Add Clerk Organization support to businesses table.
-- Each business is now linked to a Clerk Organization via clerk_org_id.
-- This enables Clerk-native member management, invitations, and RBAC.

ALTER TABLE "businesses" ADD COLUMN "clerk_org_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_businesses_clerk_org_id" ON "businesses" ("clerk_org_id");
