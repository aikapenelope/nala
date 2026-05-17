-- Migration 0021: Database hardening for production.
--
-- Fixes identified during deep DB audit:
-- 1. Missing FK constraints (sales.customer_id, quotations.customer_id,
--    day_closes.opening_id, accounting_accounts.parent_id)
-- 2. CHECK constraints for data integrity
-- 3. Missing indexes for reference lookups
-- 4. UNIQUE constraints on 1:1 settings tables
-- 5. Self-referencing FK on accounting_accounts.parent_id
--
-- PostgreSQL 16 compatible: uses DO $$ EXCEPTION blocks instead of
-- ADD CONSTRAINT IF NOT EXISTS (which requires PG17+).

-- ============================================================
-- 1. Missing FK constraints
-- ============================================================

-- sales.customer_id -> customers.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sales_customer_id_customers_id_fk'
      AND table_name = 'sales'
  ) THEN
    ALTER TABLE "sales"
      ADD CONSTRAINT "sales_customer_id_customers_id_fk"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;--> statement-breakpoint

-- quotations.customer_id -> customers.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'quotations_customer_id_customers_id_fk'
      AND table_name = 'quotations'
  ) THEN
    ALTER TABLE "quotations"
      ADD CONSTRAINT "quotations_customer_id_customers_id_fk"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;--> statement-breakpoint

-- day_closes.opening_id -> cash_openings.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'day_closes_opening_id_cash_openings_id_fk'
      AND table_name = 'day_closes'
  ) THEN
    ALTER TABLE "day_closes"
      ADD CONSTRAINT "day_closes_opening_id_cash_openings_id_fk"
      FOREIGN KEY ("opening_id") REFERENCES "cash_openings"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;--> statement-breakpoint

-- accounting_accounts.parent_id -> accounting_accounts.id (self-reference)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'accounting_accounts_parent_id_fk'
      AND table_name = 'accounting_accounts'
  ) THEN
    ALTER TABLE "accounting_accounts"
      ADD CONSTRAINT "accounting_accounts_parent_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "accounting_accounts"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;--> statement-breakpoint

-- ============================================================
-- 2. CHECK constraints for data integrity
--
-- PostgreSQL <17 does not support ADD CONSTRAINT IF NOT EXISTS.
-- Use DO $$ BEGIN ... EXCEPTION WHEN duplicate_object to skip
-- if the constraint already exists (idempotent).
-- ============================================================

-- Products
DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "chk_products_stock_gte_0" CHECK (stock >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "chk_products_price_gte_0" CHECK (price::numeric >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "chk_products_cost_gte_0" CHECK (cost::numeric >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- Product variants
DO $$ BEGIN
  ALTER TABLE "product_variants" ADD CONSTRAINT "chk_variants_stock_gte_0" CHECK (stock >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "product_variants" ADD CONSTRAINT "chk_variants_price_gte_0" CHECK (price::numeric >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "product_variants" ADD CONSTRAINT "chk_variants_cost_gte_0" CHECK (cost::numeric >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- Sale items
DO $$ BEGIN
  ALTER TABLE "sale_items" ADD CONSTRAINT "chk_sale_items_qty_gt_0" CHECK (quantity > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sale_items" ADD CONSTRAINT "chk_sale_items_unit_price_gte_0" CHECK (unit_price::numeric >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- Sales
DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "chk_sales_discount_pct_range"
    CHECK (discount_percent::numeric >= 0 AND discount_percent::numeric <= 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "chk_sales_discount_amt_gte_0" CHECK (discount_amount::numeric >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "chk_sales_total_gte_0" CHECK (total_usd::numeric >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- Orders
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "chk_orders_total_gte_0" CHECK (total::numeric >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "chk_orders_subtotal_gte_0" CHECK (subtotal::numeric >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- Exchange rates
DO $$ BEGIN
  ALTER TABLE "exchange_rates" ADD CONSTRAINT "chk_exchange_rates_bcv_gt_0" CHECK (rate_bcv::numeric > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- ============================================================
-- 3. Missing indexes for reference lookups
-- ============================================================

CREATE INDEX IF NOT EXISTS "idx_stock_movements_ref"
  ON "stock_movements" ("reference_type", "reference_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_accounting_entries_ref"
  ON "accounting_entries" ("reference_type", "reference_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_accounting_entries_business"
  ON "accounting_entries" ("business_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_price_history_product"
  ON "price_history" ("product_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_activity_log_business"
  ON "activity_log" ("business_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_activity_log_created"
  ON "activity_log" ("created_at");--> statement-breakpoint

-- ============================================================
-- 4. UNIQUE constraints on 1:1 settings tables
-- ============================================================

-- store_settings: one row per business
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_store_settings_business_unique'
  ) THEN
    CREATE UNIQUE INDEX "idx_store_settings_business_unique"
      ON "store_settings" ("business_id");
  END IF;
END $$;--> statement-breakpoint

-- notification_preferences: one row per business
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_notification_prefs_business_unique'
  ) THEN
    CREATE UNIQUE INDEX "idx_notification_prefs_business_unique"
      ON "notification_preferences" ("business_id");
  END IF;
END $$;
