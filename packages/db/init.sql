-- Nova PostgreSQL initialization script.
-- Runs once when the container is first created.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- Fuzzy text matching for OCR
CREATE EXTENSION IF NOT EXISTS "vector";      -- pgvector for semantic search (future)

-- Set up RLS helper function.
-- Each request sets app.current_business_id via SET command.
-- RLS policies use this to filter rows by tenant.
CREATE OR REPLACE FUNCTION current_business_id()
RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_business_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;
