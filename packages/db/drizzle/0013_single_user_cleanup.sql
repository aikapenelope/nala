-- Migration: Single-user model cleanup.
-- Remove legacy multi-user columns that are no longer needed:
-- - users.pin_hash, pin_failed_attempts, pin_locked_until (PIN auth removed)
-- - businesses.clerk_org_id (Clerk Organizations removed)

-- Drop PIN-related columns from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "pin_hash";
ALTER TABLE "users" DROP COLUMN IF EXISTS "pin_failed_attempts";
ALTER TABLE "users" DROP COLUMN IF EXISTS "pin_locked_until";

-- Drop Clerk Organization column and index from businesses
DROP INDEX IF EXISTS "idx_businesses_clerk_org_id";
ALTER TABLE "businesses" DROP COLUMN IF EXISTS "clerk_org_id";
