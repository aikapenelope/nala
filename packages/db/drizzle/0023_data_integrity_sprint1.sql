-- Sprint 1: Data integrity improvements
-- 1. Unique constraint on (business_id, sku) for products
-- 2. Functional unique index on exchange_rates to prevent duplicate rates per day
-- 3. ON DELETE RESTRICT on sale_items.product_id to prevent orphaned sale history

-- ============================================================
-- 1. Unique SKU per business (partial index: only when SKU is set)
-- ============================================================
-- Prevents two products in the same business from having the same SKU.
-- NULL SKUs are allowed (many products don't have one).
-- The import flow and POS barcode lookup depend on SKU uniqueness.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_products_business_sku
ON products(business_id, sku)
WHERE sku IS NOT NULL;

-- ============================================================
-- 2. Functional unique index on exchange_rates: one rate per day per business
-- ============================================================
-- The column is timestamp with time zone, but the business intent is one rate
-- per calendar day. This index uses DATE() to collapse same-day timestamps.
-- If the owner updates the rate twice in one day, the second INSERT will fail
-- with a unique violation — the API should use UPSERT (ON CONFLICT DO UPDATE).

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_exchange_rates_business_day
ON exchange_rates(business_id, DATE(date));

-- Drop the old index that allowed duplicates within the same day
DROP INDEX IF EXISTS idx_exchange_rates_business_date;

-- ============================================================
-- 3. Prevent hard-deleting products that have sale history
-- ============================================================
-- Changes the FK from default NO ACTION to explicit RESTRICT.
-- This makes the intent clear: you cannot DELETE a product row if it
-- has been sold. Use soft-delete (is_active = false) instead.
-- Note: This is a no-op if the constraint already prevents deletion,
-- but makes the behavior explicit and documented.

-- Drop existing FK and recreate with RESTRICT
ALTER TABLE sale_items
  DROP CONSTRAINT IF EXISTS sale_items_product_id_products_id_fk;

ALTER TABLE sale_items
  ADD CONSTRAINT sale_items_product_id_products_id_fk
  FOREIGN KEY (product_id) REFERENCES products(id)
  ON DELETE RESTRICT;
