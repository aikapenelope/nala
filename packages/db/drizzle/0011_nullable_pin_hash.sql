-- Migration: make pin_hash nullable (employees authenticate via Clerk, not PIN)
ALTER TABLE "users" ALTER COLUMN "pin_hash" DROP NOT NULL;
