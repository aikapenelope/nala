-- Migration 0004: Control numbers, IGTF, stock movements, BCV rate source.
--
-- 1. Control numbers: sequential per business for SENIAT readiness
-- 2. IGTF: 3% tax on foreign currency payments
-- 3. Stock movements: audit trail for every inventory change
-- 4. BCV rate source field on exchange_rates

-- ============================================================
-- Control numbers + IGTF on sales
-- ============================================================

ALTER TABLE "sales" ADD COLUMN "control_number" integer;
ALTER TABLE "sales" ADD COLUMN "igtf_amount" numeric(12,2) DEFAULT '0';

-- Sequence-like: we use a simple max(control_number)+1 per business
-- in the application layer (not a DB sequence, because it's per-tenant).

-- ============================================================
-- Stock movements table
-- ============================================================

CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "business_id" uuid NOT NULL REFERENCES "businesses"("id"),
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "variant_id" uuid REFERENCES "product_variants"("id"),
  "type" text NOT NULL,
  "quantity" integer NOT NULL,
  "cost_unit" numeric(12,2),
  "reference_type" text,
  "reference_id" uuid,
  "notes" text,
  "user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_stock_movements_business" ON "stock_movements"("business_id");
CREATE INDEX IF NOT EXISTS "idx_stock_movements_product" ON "stock_movements"("product_id");
CREATE INDEX IF NOT EXISTS "idx_stock_movements_created" ON "stock_movements"("created_at");

-- ============================================================
-- BCV rate source tracking
-- ============================================================

ALTER TABLE "exchange_rates" ADD COLUMN "source" text NOT NULL DEFAULT 'manual';
