-- Migration 0003: IVA, suppliers, credit notes, credit limits, discount amount.
--
-- Sprint A: IVA + discount amount
-- Sprint B: Suppliers table + credit limit
-- Sprint C: Credit notes (document type + original sale reference)

-- ============================================================
-- IVA fields
-- ============================================================

-- Product tax rate (0 = exento, 8 = reducido, 16 = general)
ALTER TABLE "products" ADD COLUMN "tax_rate" numeric(5,2) NOT NULL DEFAULT '0';

-- Sale tax tracking
ALTER TABLE "sales" ADD COLUMN "discount_amount" numeric(12,2) DEFAULT '0';
ALTER TABLE "sales" ADD COLUMN "subtotal_usd" numeric(12,2);
ALTER TABLE "sales" ADD COLUMN "tax_amount" numeric(12,2) DEFAULT '0';

-- Sale item tax
ALTER TABLE "sale_items" ADD COLUMN "tax_rate" numeric(5,2) DEFAULT '0';
ALTER TABLE "sale_items" ADD COLUMN "tax_amount" numeric(12,2) DEFAULT '0';

-- ============================================================
-- Credit notes
-- ============================================================

ALTER TABLE "sales" ADD COLUMN "document_type" text NOT NULL DEFAULT 'invoice';
ALTER TABLE "sales" ADD COLUMN "original_sale_id" uuid;

-- ============================================================
-- Suppliers table
-- ============================================================

CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "business_id" uuid NOT NULL REFERENCES "businesses"("id"),
  "name" text NOT NULL,
  "rif" text,
  "phone" text,
  "email" text,
  "address" text,
  "notes" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_suppliers_business" ON "suppliers"("business_id");

-- Change expenses.supplier_id from text to uuid FK
-- Step 1: rename old column
ALTER TABLE "expenses" RENAME COLUMN "supplier_id" TO "supplier_id_old";
-- Step 2: add new uuid column
ALTER TABLE "expenses" ADD COLUMN "supplier_id" uuid REFERENCES "suppliers"("id");
-- Step 3: drop old text column
ALTER TABLE "expenses" DROP COLUMN "supplier_id_old";

-- ============================================================
-- Credit limit on customers
-- ============================================================

ALTER TABLE "customers" ADD COLUMN "credit_limit_usd" numeric(12,2) NOT NULL DEFAULT '0';
