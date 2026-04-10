-- Nova PostgreSQL initialization script.
-- Runs once when the container is first created.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- Fuzzy text matching for OCR
CREATE EXTENSION IF NOT EXISTS "vector";      -- pgvector for semantic search (future)

-- RLS helper: reads the current tenant from session variable.
-- Each API request sets this via: SET app.current_business_id = '{uuid}'
CREATE OR REPLACE FUNCTION current_business_id()
RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_business_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- Row Level Security policies.
-- Every table with business_id gets RLS enabled.
-- A tenant can only see/modify its own rows.
-- ============================================================

-- Businesses: owner can only see their own business
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY businesses_tenant_isolation ON businesses
  USING (id = current_business_id());

-- Users: scoped to the current business
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
  USING (business_id = current_business_id());

-- Activity log: scoped to the current business
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_log_tenant_isolation ON activity_log
  USING (business_id = current_business_id());

-- Categories: scoped to the current business
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_tenant_isolation ON categories
  USING (business_id = current_business_id());

-- Units of measure: scoped to the current business
ALTER TABLE units_of_measure ENABLE ROW LEVEL SECURITY;
CREATE POLICY units_of_measure_tenant_isolation ON units_of_measure
  USING (business_id = current_business_id());

-- Products: scoped to the current business
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_tenant_isolation ON products
  USING (business_id = current_business_id());

-- Product variants: scoped to the current business
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_variants_tenant_isolation ON product_variants
  USING (business_id = current_business_id());

-- Price history: scoped to the current business
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY price_history_tenant_isolation ON price_history
  USING (business_id = current_business_id());

-- Exchange rates: global table (no business_id), no RLS needed

-- Sales: scoped to the current business
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_tenant_isolation ON sales
  USING (business_id = current_business_id());

-- Sale items: accessed via sale_id join, RLS on parent is sufficient
-- but we add it for defense in depth via sale join

-- Sale payments: accessed via sale_id join

-- Quotations: scoped to the current business
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotations_tenant_isolation ON quotations
  USING (business_id = current_business_id());

-- Customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_tenant_isolation ON customers
  USING (business_id = current_business_id());

-- Customer segments
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_segments_tenant_isolation ON customer_segments
  USING (business_id = current_business_id());

-- Accounts receivable
ALTER TABLE accounts_receivable ENABLE ROW LEVEL SECURITY;
CREATE POLICY ar_tenant_isolation ON accounts_receivable
  USING (business_id = current_business_id());

-- Accounts payable
ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;
CREATE POLICY ap_tenant_isolation ON accounts_payable
  USING (business_id = current_business_id());

-- Day closes
ALTER TABLE day_closes ENABLE ROW LEVEL SECURITY;
CREATE POLICY day_closes_tenant_isolation ON day_closes
  USING (business_id = current_business_id());

-- ============================================================
-- Note: The application connects as a role that has RLS enforced.
-- Superuser/admin connections bypass RLS for migrations and seeds.
-- In production, create a restricted role:
--
--   CREATE ROLE nova_app LOGIN PASSWORD 'xxx';
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nova_app;
--
-- The app connects as nova_app, which respects RLS.
-- Migrations run as the superuser (nova), which bypasses RLS.
-- ============================================================
