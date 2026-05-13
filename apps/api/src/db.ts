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
 *
 * Queries pg_tables first to discover which tables actually exist,
 * then only applies policies to those tables. Tables that haven't been
 * created yet (pending migrations) are logged and skipped.
 */
export async function applyRlsPolicies(): Promise<void> {
  const db = getDb();

  // Discover which public tables actually exist in the database.
  // This prevents crashes when migrations haven't run yet.
  const rows = await db.execute(
    sql.raw(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`),
  );
  const existingTables = new Set(
    (rows as unknown as Array<{ tablename: string }>).map((r) => r.tablename),
  );

  // Ensure current_business_id() function exists before any policy references it.
  await db.execute(
    sql.raw(
      `CREATE OR REPLACE FUNCTION current_business_id() RETURNS uuid AS $$ ` +
        `SELECT NULLIF(current_setting('app.current_business_id', true), '')::uuid; ` +
        `$$ LANGUAGE sql STABLE;`,
    ),
  );

  // Tables that need tenant isolation (business_id = current_business_id())
  const tenantTables = [
    "businesses",
    "users",
    "activity_log",
    "categories",
    "units_of_measure",
    "products",
    "product_variants",
    "price_history",
    "exchange_rates",
    "sales",
    "sale_items",
    "sale_payments",
    "quotations",
    "customers",
    "customer_segments",
    "accounts_receivable",
    "accounts_payable",
    "day_closes",
    "accounting_accounts",
    "accounting_entries",
    "expenses",
    "suppliers",
    "expense_items",
    "product_aliases",
    "stock_movements",
    "cash_openings",
    "surcharge_types",
    "bank_accounts",
    "notification_preferences",
    "store_settings",
    "orders",
    "sale_returns",
    "sale_return_items",
  ];

  const skipped: string[] = [];

  for (const table of tenantTables) {
    if (!existingTables.has(table)) {
      skipped.push(table);
      continue;
    }

    const usingClause =
      table === "businesses"
        ? "id = current_business_id()"
        : "business_id = current_business_id()";

    await db.execute(
      sql.raw(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY; ` +
          `DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}"; ` +
          `CREATE POLICY "${table}_tenant_isolation" ON "${table}" USING (${usingClause});`,
      ),
    );
  }

  // Auth bypass policies (needed before tenant context is set)
  for (const table of ["businesses", "users"]) {
    if (!existingTables.has(table)) continue;

    await db.execute(
      sql.raw(
        `DROP POLICY IF EXISTS "${table}_auth_lookup" ON "${table}"; ` +
          `CREATE POLICY "${table}_auth_lookup" ON "${table}" FOR SELECT USING (current_business_id() IS NULL);`,
      ),
    );
  }

  // Orders: public insert for storefront checkout (no auth context)
  if (existingTables.has("orders")) {
    await db.execute(
      sql.raw(
        `DROP POLICY IF EXISTS "orders_public_insert" ON "orders"; ` +
          `CREATE POLICY "orders_public_insert" ON "orders" FOR INSERT ` +
          `WITH CHECK (current_business_id() IS NULL OR business_id = current_business_id());`,
      ),
    );
  }

  if (skipped.length > 0) {
    console.warn(
      `[startup] RLS skipped for missing tables: ${skipped.join(", ")}. ` +
        `These will be applied on the next deploy after migrations run.`,
    );
  }
}
