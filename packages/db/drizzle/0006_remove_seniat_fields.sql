-- Migration 0006: Remove SENIAT/fiscal fields.
--
-- Nova targets informal commerce in Venezuela. These fields were added
-- for SENIAT tax compliance but add unnecessary complexity to the
-- critical sales flow without benefiting the target user.
--
-- Safe to run: all columns are either DEFAULT 0/null or unused in production.

ALTER TABLE "products" DROP COLUMN IF EXISTS "tax_rate";
ALTER TABLE "sales" DROP COLUMN IF EXISTS "subtotal_usd";
ALTER TABLE "sales" DROP COLUMN IF EXISTS "tax_amount";
ALTER TABLE "sales" DROP COLUMN IF EXISTS "igtf_amount";
ALTER TABLE "sales" DROP COLUMN IF EXISTS "control_number";
ALTER TABLE "sales" DROP COLUMN IF EXISTS "fiscal_control_number";
ALTER TABLE "sales" DROP COLUMN IF EXISTS "document_type";
ALTER TABLE "sales" DROP COLUMN IF EXISTS "original_sale_id";
ALTER TABLE "sale_items" DROP COLUMN IF EXISTS "tax_rate";
ALTER TABLE "sale_items" DROP COLUMN IF EXISTS "tax_amount";
ALTER TABLE "businesses" DROP COLUMN IF EXISTS "rif";
ALTER TABLE "customers" DROP COLUMN IF EXISTS "rif";
