/**
 * Database singleton for the API server.
 *
 * Initializes a single Drizzle ORM instance at startup.
 * Routes access it via `getDb()` rather than creating per-request connections.
 */

import { sql } from "drizzle-orm";
import { createDb, type Database } from "@nova/db";

let _db: Database | null = null;

/**
 * Initialize the database connection.
 * Call once at server startup. Throws if DATABASE_URL is not set.
 */
export function initDb(): Database {
  if (_db) return _db;
  _db = createDb();
  return _db;
}

/**
 * Get the database instance.
 * Throws if `initDb()` has not been called yet.
 */
export function getDb(): Database {
  if (!_db) {
    throw new Error("Database not initialized. Call initDb() at startup.");
  }
  return _db;
}

/**
 * Get the database instance if available, or null.
 * Used by health checks and other non-critical paths that should
 * not crash when the database is not configured.
 */
export function tryGetDb(): Database | null {
  return _db;
}

/**
 * Apply RLS policies on startup.
 *
 * Ensures all tables have the correct tenant isolation policies.
 * Safe to run on every deploy (all statements are idempotent).
 * This replaces the need to manually run init.sql after schema changes.
 */
export async function applyRlsPolicies(): Promise<void> {
  const db = getDb();

  // Tables that need tenant isolation (business_id = current_business_id())
  const tenantTables = [
    "businesses", "users", "activity_log", "categories", "units_of_measure",
    "products", "product_variants", "price_history", "exchange_rates",
    "sales", "sale_items", "sale_payments", "quotations", "customers",
    "customer_segments", "accounts_receivable", "accounts_payable",
    "day_closes", "accounting_accounts", "accounting_entries", "expenses",
    "suppliers", "expense_items", "product_aliases", "stock_movements",
    "cash_openings", "surcharge_types", "bank_accounts",
    "notification_preferences", "store_settings", "orders",
  ];

  for (const table of tenantTables) {
    const policyName = table === "businesses"
      ? `${table}_tenant_isolation`
      : `${table}_tenant_isolation`;
    const usingClause = table === "businesses"
      ? "id = current_business_id()"
      : "business_id = current_business_id()";

    await db.execute(sql.raw(
      `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;` +
      `DROP POLICY IF EXISTS ${policyName} ON ${table};` +
      `CREATE POLICY ${policyName} ON ${table} USING (${usingClause});`,
    ));
  }

  // Auth bypass policies (needed before tenant context is set)
  const authBypassTables = ["businesses", "users"];
  for (const table of authBypassTables) {
    await db.execute(sql.raw(
      `DROP POLICY IF EXISTS ${table}_auth_lookup ON ${table};` +
      `CREATE POLICY ${table}_auth_lookup ON ${table} FOR SELECT USING (current_business_id() IS NULL);`,
    ));
  }

  // Orders: public insert for storefront checkout (no auth context)
  await db.execute(sql.raw(
    `DROP POLICY IF EXISTS orders_public_insert ON orders;` +
    `CREATE POLICY orders_public_insert ON orders FOR INSERT ` +
    `WITH CHECK (current_business_id() IS NULL OR business_id = current_business_id());`,
  ));

  // Ensure current_business_id() function exists
  await db.execute(sql.raw(
    `CREATE OR REPLACE FUNCTION current_business_id() RETURNS uuid AS $$ ` +
    `SELECT NULLIF(current_setting('app.current_business_id', true), '')::uuid; ` +
    `$$ LANGUAGE sql STABLE;`,
  ));
}
