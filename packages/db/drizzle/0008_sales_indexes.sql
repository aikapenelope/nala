-- Migration 0008: Add indexes for sales query performance.
--
-- sales.customer_id is used in GET /sales?customerId= and reports/customer-stats.
-- sales.channel is used in GET /sales?channel= filter.

CREATE INDEX IF NOT EXISTS "idx_sales_customer" ON "sales"("customer_id");
CREATE INDEX IF NOT EXISTS "idx_sales_channel" ON "sales"("channel");
