/**
 * Integration test helpers.
 *
 * Provides a real database connection and utilities to create
 * test businesses, users, products, and exchange rates.
 *
 * Requires DATABASE_URL to point to a test database.
 * In CI, PostgreSQL is available as a service (see .github/workflows/ci.yml).
 *
 * Each test suite should call `cleanupTestData()` in afterAll to remove
 * its test data. RLS is disabled for test queries (no set_config needed).
 */

import { createDb, type Database } from "@nova/db";
import {
  businesses,
  users,
  categories,
  accountingAccounts,
  products,
  exchangeRates,
  sales,
  accountsReceivable,
  customers,
  activityLog,
  accountingEntries,
} from "@nova/db";
import { sql } from "drizzle-orm";

/** Pre-computed bcrypt hash for test PIN "0000" (cost 10). Legacy, kept for backward compat. */
const PIN_HASH_0000 =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

let _testDb: Database | null = null;

/** Get or create the test database connection. */
export function getTestDb(): Database {
  if (!_testDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is required for integration tests. " +
          "Run with: DATABASE_URL=postgresql://nova:test@localhost:5432/nova_test npm test",
      );
    }
    _testDb = createDb(url);
  }
  return _testDb;
}

/** IDs tracked for cleanup. */
const createdBusinessIds: string[] = [];

/** Result of creating a test business with owner. */
export interface TestBusiness {
  business: typeof businesses.$inferSelect;
  owner: typeof users.$inferSelect;
}

/**
 * Create a test business with an owner user, categories, and accounting chart.
 * Mirrors the onboarding flow.
 */
export async function createTestBusiness(
  db: Database,
  overrides?: { slug?: string; name?: string },
): Promise<TestBusiness> {
  const suffix = Math.random().toString(36).slice(2, 8);
  const slug = overrides?.slug ?? `test-biz-${suffix}`;
  const name = overrides?.name ?? `Test Business ${suffix}`;

  const result = await db.transaction(async (tx) => {
    const [business] = await tx
      .insert(businesses)
      .values({
        name,
        type: "bodega",
        slug,
        phone: "+58412-000-0000",
      })
      .returning();

    const [owner] = await tx
      .insert(users)
      .values({
        businessId: business.id,
        clerkId: `test-clerk-${suffix}`,
        name: "Test Owner",
        role: "owner",
        pinHash: PIN_HASH_0000,
      })
      .returning();

    // Default categories
    await tx.insert(categories).values(
      ["Abarrotes", "Bebidas", "Otros"].map((cat, idx) => ({
        businessId: business.id,
        name: cat,
        sortOrder: idx,
      })),
    );

    // Default accounting chart
    await tx.insert(accountingAccounts).values(
      [
        { code: "1101", name: "Caja (Efectivo)", type: "asset" },
        { code: "1102", name: "Bancos", type: "asset" },
        { code: "1103", name: "Cuentas por cobrar", type: "asset" },
        { code: "1104", name: "Inventario", type: "asset" },
        { code: "2101", name: "Cuentas por pagar", type: "liability" },
        { code: "4101", name: "Ventas", type: "revenue" },
        { code: "5101", name: "Costo de ventas", type: "expense" },
        { code: "5201", name: "Gastos operativos", type: "expense" },
      ].map((acc) => ({
        businessId: business.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
      })),
    );

    return { business, owner };
  });

  createdBusinessIds.push(result.business.id);
  return result;
}

/** Create a test product for a business. */
export async function createTestProduct(
  db: Database,
  businessId: string,
  overrides?: { name?: string; price?: string; cost?: string; stock?: number },
) {
  const [product] = await db
    .insert(products)
    .values({
      businessId,
      name: overrides?.name ?? "Test Product",
      price: overrides?.price ?? "10.00",
      cost: overrides?.cost ?? "5.00",
      stock: overrides?.stock ?? 100,
    })
    .returning();
  return product;
}

/** Create a test customer for a business. */
export async function createTestCustomer(
  db: Database,
  businessId: string,
  overrides?: { name?: string },
) {
  const [customer] = await db
    .insert(customers)
    .values({
      businessId,
      name: overrides?.name ?? "Test Customer",
    })
    .returning();
  return customer;
}

/** Set an exchange rate for a business (required before creating sales). */
export async function setTestExchangeRate(
  db: Database,
  businessId: string,
  rateBcv: number = 36.5,
) {
  const [rate] = await db
    .insert(exchangeRates)
    .values({
      businessId,
      date: new Date(),
      rateBcv: String(rateBcv),
    })
    .returning();
  return rate;
}

/** Create a second user (employee) for a business. */
export async function createTestEmployee(
  db: Database,
  businessId: string,
  overrides?: { name?: string },
) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const [employee] = await db
    .insert(users)
    .values({
      businessId,
      name: overrides?.name ?? `Employee ${suffix}`,
      role: "employee",
      clerkId: `test-clerk-emp-${suffix}`,
    })
    .returning();
  return employee;
}

/**
 * Clean up all test data created during the test suite.
 * Deletes in reverse dependency order to avoid FK violations.
 */
export async function cleanupTestData(db: Database): Promise<void> {
  if (createdBusinessIds.length === 0) return;

  // Delete in reverse dependency order
  for (const bizId of createdBusinessIds) {
    await db
      .delete(accountingEntries)
      .where(sql`${accountingEntries.businessId} = ${bizId}`);
    await db
      .delete(activityLog)
      .where(sql`${activityLog.businessId} = ${bizId}`);
    await db
      .delete(accountsReceivable)
      .where(sql`${accountsReceivable.businessId} = ${bizId}`);

    // sale_items and sale_payments cascade from sales
    await db.delete(sales).where(sql`${sales.businessId} = ${bizId}`);

    await db.delete(products).where(sql`${products.businessId} = ${bizId}`);
    await db.delete(customers).where(sql`${customers.businessId} = ${bizId}`);
    await db
      .delete(exchangeRates)
      .where(sql`${exchangeRates.businessId} = ${bizId}`);
    await db
      .delete(accountingAccounts)
      .where(sql`${accountingAccounts.businessId} = ${bizId}`);
    await db.delete(categories).where(sql`${categories.businessId} = ${bizId}`);
    await db.delete(users).where(sql`${users.businessId} = ${bizId}`);
    await db.delete(businesses).where(sql`${businesses.id} = ${bizId}`);
  }

  createdBusinessIds.length = 0;
}
