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
 * Queries pg_tables and information_schema.columns to discover which tables
 * and columns actually exist, then only applies policies to tables that have
 * the expected isolation column. This prevents crashes from schema mismatches.
 */
export async function applyRlsPolicies(): Promise<void> {
  const db = getDb();

  // Discover which public tables actually exist in the database.
  const tableRows = await db.execute(
    sql.raw(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`),
  );
  const existingTables = new Set(
    (tableRows as unknown as Array<{ tablename: string }>).map(
      (r) => r.tablename,
    ),
  );

  // Discover which columns exist per table (for validation).
  const columnRows = await db.execute(
    sql.raw(
      `SELECT table_name, column_name FROM information_schema.columns ` +
        `WHERE table_schema = 'public'`,
    ),
  );
  const tableColumns = new Map<string, Set<string>>();
  for (const row of columnRows as unknown as Array<{
    table_name: string;
    column_name: string;
  }>) {
    if (!tableColumns.has(row.table_name)) {
      tableColumns.set(row.table_name, new Set());
    }
    tableColumns.get(row.table_name)!.add(row.column_name);
  }

  // Ensure current_business_id() function exists before any policy references it.
  await db.execute(
    sql.raw(
      `CREATE OR REPLACE FUNCTION current_business_id() RETURNS uuid AS $$ ` +
        `SELECT NULLIF(current_setting('app.current_business_id', true), '')::uuid; ` +
        `$$ LANGUAGE sql STABLE;`,
    ),
  );

  // ---------------------------------------------------------------
  // Tenant isolation policies.
  //
  // Each entry maps a table name to the column used for isolation.
  // Most tables use "business_id"; "businesses" uses "id".
  // Tables without a direct business_id (e.g., sale_return_items)
  // are NOT listed here — they rely on their parent table's RLS.
  // ---------------------------------------------------------------
  const tenantPolicies: Array<{ table: string; column: string }> = [
    { table: "businesses", column: "id" },
    { table: "users", column: "business_id" },
    { table: "activity_log", column: "business_id" },
    { table: "categories", column: "business_id" },
    { table: "units_of_measure", column: "business_id" },
    { table: "products", column: "business_id" },
    { table: "product_variants", column: "business_id" },
    { table: "price_history", column: "business_id" },
    { table: "exchange_rates", column: "business_id" },
    { table: "sales", column: "business_id" },
    { table: "sale_items", column: "business_id" },
    { table: "sale_payments", column: "business_id" },
    { table: "quotations", column: "business_id" },
    { table: "customers", column: "business_id" },
    { table: "customer_segments", column: "business_id" },
    { table: "accounts_receivable", column: "business_id" },
    { table: "accounts_payable", column: "business_id" },
    { table: "day_closes", column: "business_id" },
    { table: "accounting_accounts", column: "business_id" },
    { table: "accounting_entries", column: "business_id" },
    { table: "expenses", column: "business_id" },
    { table: "suppliers", column: "business_id" },
    { table: "expense_items", column: "business_id" },
    { table: "product_aliases", column: "business_id" },
    { table: "stock_movements", column: "business_id" },
    { table: "cash_openings", column: "business_id" },
    { table: "surcharge_types", column: "business_id" },
    { table: "bank_accounts", column: "business_id" },
    { table: "notification_preferences", column: "business_id" },
    { table: "store_settings", column: "business_id" },
    { table: "orders", column: "business_id" },
    { table: "sale_returns", column: "business_id" },
    // sale_return_items: no business_id — isolated via sale_returns FK + RLS
    { table: "product_images", column: "business_id" },
    { table: "push_subscriptions", column: "business_id" },
  ];

  const skipped: string[] = [];
  const missingColumn: string[] = [];

  for (const { table, column } of tenantPolicies) {
    // Skip tables that don't exist yet (pending migrations)
    if (!existingTables.has(table)) {
      skipped.push(table);
      continue;
    }

    // Validate the isolation column actually exists in the table.
    // This catches configuration errors at startup instead of at query time.
    const columns = tableColumns.get(table);
    if (!columns || !columns.has(column)) {
      missingColumn.push(`${table}.${column}`);
      console.error(
        `[startup] RLS ERROR: table "${table}" exists but column "${column}" does not. ` +
          `Fix the tenantPolicies config in db.ts or add the column via migration.`,
      );
      continue;
    }

    await db.execute(
      sql.raw(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY; ` +
          `DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}"; ` +
          `CREATE POLICY "${table}_tenant_isolation" ON "${table}" ` +
          `USING (${column} = current_business_id());`,
      ),
    );
  }

  // Auth bypass policies (needed before tenant context is set)
  for (const table of ["businesses", "users"]) {
    if (!existingTables.has(table)) continue;

    await db.execute(
      sql.raw(
        `DROP POLICY IF EXISTS "${table}_auth_lookup" ON "${table}"; ` +
          `CREATE POLICY "${table}_auth_lookup" ON "${table}" FOR SELECT ` +
          `USING (current_business_id() IS NULL);`,
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

  // Report results
  if (skipped.length > 0) {
    console.warn(
      `[startup] RLS skipped for missing tables: ${skipped.join(", ")}. ` +
        `These will be applied on the next deploy after migrations run.`,
    );
  }

  if (missingColumn.length > 0) {
    // This is a hard error in the configuration — the table exists but the
    // column doesn't. Throw so the server fails to start and the developer
    // notices immediately. Silent warnings here would hide data leaks.
    throw new Error(
      `[startup] RLS configuration error: columns not found: ${missingColumn.join(", ")}. ` +
        `The server cannot start with broken tenant isolation. ` +
        `Fix tenantPolicies in apps/api/src/db.ts or add the missing columns.`,
    );
  }
}
