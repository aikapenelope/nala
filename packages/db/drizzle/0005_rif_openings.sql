-- Migration 0005: RIF fields, fiscal control number, cash openings, debit note.
--
-- 1. RIF on businesses and customers
-- 2. Fiscal control number on sales (assigned by digital printer)
-- 3. Cash register openings table
-- 4. Opening ID on day_closes

-- ============================================================
-- RIF fields
-- ============================================================

ALTER TABLE "businesses" ADD COLUMN "rif" text;
ALTER TABLE "customers" ADD COLUMN "rif" text;

-- ============================================================
-- Fiscal control number (from authorized digital printer)
-- ============================================================

ALTER TABLE "sales" ADD COLUMN "fiscal_control_number" text;

-- ============================================================
-- Cash register openings
-- ============================================================

CREATE TABLE IF NOT EXISTS "cash_openings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "business_id" uuid NOT NULL REFERENCES "businesses"("id"),
  "opened_by" uuid NOT NULL REFERENCES "users"("id"),
  "date" timestamptz NOT NULL,
  "cash_amount" numeric(12,2) NOT NULL,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "day_closes" ADD COLUMN "opening_id" uuid;
