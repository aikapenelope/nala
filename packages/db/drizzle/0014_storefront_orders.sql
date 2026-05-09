-- Migration 0014: Storefront tables (orders + store_settings).
-- Enables online ordering via tenant subdomain PWA.

-- ============================================================
-- Orders: online orders placed by customers via the storefront
-- ============================================================

CREATE TABLE IF NOT EXISTS "orders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "business_id" UUID NOT NULL REFERENCES "businesses"("id"),

  -- Customer info (no account required)
  "customer_name" TEXT NOT NULL,
  "customer_phone" TEXT NOT NULL,
  "customer_notes" TEXT,

  -- Order contents (snapshot at time of order)
  "items" JSONB NOT NULL DEFAULT '[]',

  -- Totals
  "subtotal" NUMERIC(12,2) NOT NULL,
  "delivery_fee" NUMERIC(12,2) NOT NULL DEFAULT '0',
  "total" NUMERIC(12,2) NOT NULL,

  -- Payment
  "payment_method" TEXT NOT NULL,
  "payment_proof_url" TEXT,
  "payment_reference" TEXT,

  -- Status lifecycle: pending -> confirmed -> delivered | cancelled
  "status" TEXT NOT NULL DEFAULT 'pending',

  -- Metadata
  "exchange_rate" NUMERIC(12,4),
  "total_bs" NUMERIC(12,2),
  "channel" TEXT NOT NULL DEFAULT 'storefront',

  -- Timestamps for status transitions
  "confirmed_at" TIMESTAMP WITH TIME ZONE,
  "delivered_at" TIMESTAMP WITH TIME ZONE,
  "cancelled_at" TIMESTAMP WITH TIME ZONE,
  "cancel_reason" TEXT,

  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_orders_business" ON "orders"("business_id");
CREATE INDEX IF NOT EXISTS "idx_orders_business_status" ON "orders"("business_id", "status");
CREATE INDEX IF NOT EXISTS "idx_orders_created" ON "orders"("created_at");

-- RLS
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_tenant_isolation" ON "orders"
  USING ("business_id" = current_setting('app.current_business_id')::uuid);

-- ============================================================
-- Store settings: per-business storefront configuration
-- ============================================================

CREATE TABLE IF NOT EXISTS "store_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "business_id" UUID NOT NULL UNIQUE REFERENCES "businesses"("id"),

  -- Activation
  "store_enabled" BOOLEAN NOT NULL DEFAULT false,

  -- Payment methods accepted (JSON array)
  -- Example: [{ "method": "pago_movil", "label": "Pago Movil", "details": { "bank": "Banesco", "phone": "0412...", "ci": "V-12345" } }]
  "payment_methods" JSONB NOT NULL DEFAULT '[]',

  -- Delivery configuration
  "delivery_enabled" BOOLEAN NOT NULL DEFAULT false,
  "delivery_fee" NUMERIC(12,2) NOT NULL DEFAULT '0',
  "delivery_zones" TEXT,

  -- Customization
  "welcome_message" TEXT,
  "min_order_amount" NUMERIC(12,2) NOT NULL DEFAULT '0',

  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE "store_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_settings_tenant_isolation" ON "store_settings"
  USING ("business_id" = current_setting('app.current_business_id')::uuid);
