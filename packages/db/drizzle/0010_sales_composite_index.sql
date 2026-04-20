-- Migration 0010: Add composite index on sales for report query performance.
--
-- Reports (daily, weekly, financial, cash-flow) all query sales filtered by
-- business_id and ordered by created_at. This composite index eliminates
-- sequential scans on large sales tables.
-- Pattern inspired by ERPNext's programmatic index on Stock Ledger Entry.

CREATE INDEX IF NOT EXISTS "idx_sales_business_created"
  ON "sales"("business_id", "created_at" DESC);
