-- Migration 0015: Partial returns support.
--
-- Adds a sale_returns table to track partial (or full) product returns
-- without voiding the entire sale. Each return references the original
-- sale and contains line items with quantities returned.

CREATE TABLE IF NOT EXISTS "sale_returns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "business_id" uuid NOT NULL REFERENCES "businesses"("id"),
  "sale_id" uuid NOT NULL REFERENCES "sales"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "reason" text NOT NULL,
  "total_refund_usd" numeric(12,2) NOT NULL DEFAULT '0',
  "status" text NOT NULL DEFAULT 'completed',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sale_return_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "return_id" uuid NOT NULL REFERENCES "sale_returns"("id") ON DELETE CASCADE,
  "sale_item_id" uuid NOT NULL REFERENCES "sale_items"("id"),
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "variant_id" uuid REFERENCES "product_variants"("id"),
  "quantity" integer NOT NULL,
  "unit_price" numeric(12,2) NOT NULL,
  "line_total" numeric(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_sale_returns_sale" ON "sale_returns"("sale_id");
CREATE INDEX IF NOT EXISTS "idx_sale_returns_business" ON "sale_returns"("business_id");
CREATE INDEX IF NOT EXISTS "idx_sale_return_items_return" ON "sale_return_items"("return_id");
