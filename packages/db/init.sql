-- Nova PostgreSQL initialization script.
-- Safe to re-run on every deploy (all statements are idempotent).

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
--
-- DROP + CREATE pattern ensures policies are always up to date.
-- ============================================================

-- Businesses
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS businesses_tenant_isolation ON businesses;
CREATE POLICY businesses_tenant_isolation ON businesses
  USING (id = current_business_id());

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
  USING (business_id = current_business_id());

-- Activity log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activity_log_tenant_isolation ON activity_log;
CREATE POLICY activity_log_tenant_isolation ON activity_log
  USING (business_id = current_business_id());

-- Categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS categories_tenant_isolation ON categories;
CREATE POLICY categories_tenant_isolation ON categories
  USING (business_id = current_business_id());

-- Units of measure
ALTER TABLE units_of_measure ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS units_of_measure_tenant_isolation ON units_of_measure;
CREATE POLICY units_of_measure_tenant_isolation ON units_of_measure
  USING (business_id = current_business_id());

-- Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_tenant_isolation ON products;
CREATE POLICY products_tenant_isolation ON products
  USING (business_id = current_business_id());

-- Product variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_variants_tenant_isolation ON product_variants;
CREATE POLICY product_variants_tenant_isolation ON product_variants
  USING (business_id = current_business_id());

-- Price history
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS price_history_tenant_isolation ON price_history;
CREATE POLICY price_history_tenant_isolation ON price_history
  USING (business_id = current_business_id());

-- Exchange rates: global table (no business_id), no RLS needed

-- Exchange rates (per-business, RLS enabled)
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exchange_rates_tenant_isolation ON exchange_rates;
CREATE POLICY exchange_rates_tenant_isolation ON exchange_rates
  USING (business_id = current_business_id());

-- Sales
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_tenant_isolation ON sales;
CREATE POLICY sales_tenant_isolation ON sales
  USING (business_id = current_business_id());

-- Sale items
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sale_items_tenant_isolation ON sale_items;
CREATE POLICY sale_items_tenant_isolation ON sale_items
  USING (business_id = current_business_id());

-- Sale payments
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sale_payments_tenant_isolation ON sale_payments;
CREATE POLICY sale_payments_tenant_isolation ON sale_payments
  USING (business_id = current_business_id());

-- Quotations
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quotations_tenant_isolation ON quotations;
CREATE POLICY quotations_tenant_isolation ON quotations
  USING (business_id = current_business_id());

-- Customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customers_tenant_isolation ON customers;
CREATE POLICY customers_tenant_isolation ON customers
  USING (business_id = current_business_id());

-- Customer segments
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_segments_tenant_isolation ON customer_segments;
CREATE POLICY customer_segments_tenant_isolation ON customer_segments
  USING (business_id = current_business_id());

-- Accounts receivable
ALTER TABLE accounts_receivable ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ar_tenant_isolation ON accounts_receivable;
CREATE POLICY ar_tenant_isolation ON accounts_receivable
  USING (business_id = current_business_id());

-- Accounts payable
ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ap_tenant_isolation ON accounts_payable;
CREATE POLICY ap_tenant_isolation ON accounts_payable
  USING (business_id = current_business_id());

-- Day closes
ALTER TABLE day_closes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS day_closes_tenant_isolation ON day_closes;
CREATE POLICY day_closes_tenant_isolation ON day_closes
  USING (business_id = current_business_id());

-- Accounting accounts
ALTER TABLE accounting_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounting_accounts_tenant_isolation ON accounting_accounts;
CREATE POLICY accounting_accounts_tenant_isolation ON accounting_accounts
  USING (business_id = current_business_id());

-- Accounting entries
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounting_entries_tenant_isolation ON accounting_entries;
CREATE POLICY accounting_entries_tenant_isolation ON accounting_entries
  USING (business_id = current_business_id());

-- Expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expenses_tenant_isolation ON expenses;
CREATE POLICY expenses_tenant_isolation ON expenses
  USING (business_id = current_business_id());

-- Expense items
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expense_items_tenant_isolation ON expense_items;
CREATE POLICY expense_items_tenant_isolation ON expense_items
  USING (business_id = current_business_id());

-- Product aliases
ALTER TABLE product_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_aliases_tenant_isolation ON product_aliases;
CREATE POLICY product_aliases_tenant_isolation ON product_aliases
  USING (business_id = current_business_id());
