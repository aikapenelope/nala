-- Migration 0002: Add business_id to child tables for RLS defense in depth.
--
-- These tables (sale_items, sale_payments, expense_items) previously relied
-- on JOINs with their parent tables for tenant isolation. Adding business_id
-- directly enables RLS policies on the child tables themselves.
--
-- Strategy: add nullable -> backfill from parent -> set NOT NULL -> add FK.

-- ============================================================
-- sale_items: backfill from sales.business_id
-- ============================================================

ALTER TABLE "sale_items" ADD COLUMN "business_id" uuid;

UPDATE "sale_items" SET "business_id" = "sales"."business_id"
FROM "sales" WHERE "sale_items"."sale_id" = "sales"."id";

ALTER TABLE "sale_items" ALTER COLUMN "business_id" SET NOT NULL;

ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_business_id_businesses_id_fk"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ============================================================
-- sale_payments: backfill from sales.business_id
-- ============================================================

ALTER TABLE "sale_payments" ADD COLUMN "business_id" uuid;

UPDATE "sale_payments" SET "business_id" = "sales"."business_id"
FROM "sales" WHERE "sale_payments"."sale_id" = "sales"."id";

ALTER TABLE "sale_payments" ALTER COLUMN "business_id" SET NOT NULL;

ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_business_id_businesses_id_fk"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ============================================================
-- expense_items: backfill from expenses.business_id
-- ============================================================

ALTER TABLE "expense_items" ADD COLUMN "business_id" uuid;

UPDATE "expense_items" SET "business_id" = "expenses"."business_id"
FROM "expenses" WHERE "expense_items"."expense_id" = "expenses"."id";

ALTER TABLE "expense_items" ALTER COLUMN "business_id" SET NOT NULL;

ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_business_id_businesses_id_fk"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
