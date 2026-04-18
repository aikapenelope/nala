-- Migration 0007: Feature parity fields.
--
-- Adds fields for: service products, wholesale pricing, sale profit tracking,
-- surcharges, sale channels, expense categories, product brand/location,
-- and bank account tracking.

-- Products: service flag, wholesale pricing, brand, location
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_service" boolean NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "wholesale_price" numeric(12,2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "wholesale_min_qty" integer NOT NULL DEFAULT 1;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "location" text;

-- Sales: profit tracking, channel, surcharges
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "total_cost_usd" numeric(12,2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "channel" text NOT NULL DEFAULT 'pos';
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "surcharges" jsonb DEFAULT '[]';

-- Expenses: category (fixed/variable/cogs)
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'variable';

-- Surcharge types per business
CREATE TABLE IF NOT EXISTS "surcharge_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "business_id" uuid NOT NULL REFERENCES "businesses"("id"),
  "name" text NOT NULL,
  "amount" numeric(12,2),
  "percentage" numeric(5,2),
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Bank accounts per business
CREATE TABLE IF NOT EXISTS "bank_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "business_id" uuid NOT NULL REFERENCES "businesses"("id"),
  "name" text NOT NULL,
  "bank_name" text,
  "account_type" text NOT NULL DEFAULT 'checking',
  "initial_balance" numeric(12,2) NOT NULL DEFAULT '0',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Notification preferences per business
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "business_id" uuid NOT NULL REFERENCES "businesses"("id"),
  "email_daily_alerts" boolean NOT NULL DEFAULT false,
  "alert_email" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("business_id")
);

-- RLS for new tables
ALTER TABLE "surcharge_types" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS surcharge_types_tenant_isolation ON surcharge_types;
CREATE POLICY surcharge_types_tenant_isolation ON surcharge_types
  USING (business_id = current_business_id());

ALTER TABLE "bank_accounts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bank_accounts_tenant_isolation ON bank_accounts;
CREATE POLICY bank_accounts_tenant_isolation ON bank_accounts
  USING (business_id = current_business_id());

ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_preferences_tenant_isolation ON notification_preferences;
CREATE POLICY notification_preferences_tenant_isolation ON notification_preferences
  USING (business_id = current_business_id());

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_surcharge_types_business" ON "surcharge_types"("business_id");
CREATE INDEX IF NOT EXISTS "idx_bank_accounts_business" ON "bank_accounts"("business_id");
CREATE INDEX IF NOT EXISTS "idx_products_brand" ON "products"("brand");
