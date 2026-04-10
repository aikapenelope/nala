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
