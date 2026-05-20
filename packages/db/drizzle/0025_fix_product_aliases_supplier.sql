-- Fix product_aliases.supplier_id: currently stores supplier NAME (text), not a UUID.
-- The OCR pipeline saves the supplier name from the invoice into this field.
--
-- Solution: rename the existing column to supplier_name (what it actually contains),
-- and add a proper supplier_id UUID FK for future use when suppliers are linked.
-- This is backward compatible — existing data stays intact.

-- Step 1: Rename the misnamed column to reflect its actual content
ALTER TABLE product_aliases RENAME COLUMN supplier_id TO supplier_name;

-- Step 2: Add a proper supplier_id UUID column with FK
ALTER TABLE product_aliases
  ADD COLUMN supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

-- Step 3: Index for lookups by supplier
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aliases_supplier
ON product_aliases(supplier_id)
WHERE supplier_id IS NOT NULL;
