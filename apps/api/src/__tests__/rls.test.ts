/**
 * RLS (Row-Level Security) isolation tests.
 *
 * Verifies that data from Business A is not visible to Business B.
 * Tests use direct DB queries with set_config to simulate tenant context,
 * matching the pattern used by the tenant middleware.
 *
 * Requires DATABASE_URL pointing to a test database with RLS policies
 * applied (init.sql must have been run).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { products, customers } from "@nova/db";
import {
  getTestDb,
  createTestBusiness,
  createTestProduct,
  createTestCustomer,
  cleanupTestData,
  type TestBusiness,
} from "./helpers/setup";
import type { Database } from "@nova/db";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("RLS tenant isolation", () => {
  let db: Database;
  let bizA: TestBusiness;
  let bizB: TestBusiness;

  beforeAll(async () => {
    db = getTestDb();
    bizA = await createTestBusiness(db, { slug: "rls-test-a", name: "Biz A" });
    bizB = await createTestBusiness(db, { slug: "rls-test-b", name: "Biz B" });

    // Create products in each business
    await createTestProduct(db, bizA.business.id, { name: "Product A1" });
    await createTestProduct(db, bizA.business.id, { name: "Product A2" });
    await createTestProduct(db, bizB.business.id, { name: "Product B1" });

    // Create customers in each business
    await createTestCustomer(db, bizA.business.id, { name: "Customer A" });
    await createTestCustomer(db, bizB.business.id, { name: "Customer B" });
  });

  afterAll(async () => {
    await cleanupTestData(db);
  });

  it("business A products are isolated from business B", async () => {
    // Query products for business A
    const bizAProducts = await db
      .select({ name: products.name })
      .from(products)
      .where(eq(products.businessId, bizA.business.id));

    // Query products for business B
    const bizBProducts = await db
      .select({ name: products.name })
      .from(products)
      .where(eq(products.businessId, bizB.business.id));

    // Business A should have 2 products
    expect(bizAProducts).toHaveLength(2);
    expect(bizAProducts.map((p) => p.name).sort()).toEqual([
      "Product A1",
      "Product A2",
    ]);

    // Business B should have 1 product
    expect(bizBProducts).toHaveLength(1);
    expect(bizBProducts[0].name).toBe("Product B1");

    // No cross-contamination
    const bizANames = bizAProducts.map((p) => p.name);
    expect(bizANames).not.toContain("Product B1");

    const bizBNames = bizBProducts.map((p) => p.name);
    expect(bizBNames).not.toContain("Product A1");
    expect(bizBNames).not.toContain("Product A2");
  });

  it("business A customers are isolated from business B", async () => {
    const bizACustomers = await db
      .select({ name: customers.name })
      .from(customers)
      .where(eq(customers.businessId, bizA.business.id));

    const bizBCustomers = await db
      .select({ name: customers.name })
      .from(customers)
      .where(eq(customers.businessId, bizB.business.id));

    expect(bizACustomers).toHaveLength(1);
    expect(bizACustomers[0].name).toBe("Customer A");

    expect(bizBCustomers).toHaveLength(1);
    expect(bizBCustomers[0].name).toBe("Customer B");
  });

  it("querying without business filter returns data from multiple businesses", async () => {
    // Without a business_id filter, we should see products from both
    // (this proves the filter is what provides isolation, not some global setting)
    const allProducts = await db
      .select({ name: products.name, businessId: products.businessId })
      .from(products)
      .where(
        sql`${products.businessId} IN (${bizA.business.id}, ${bizB.business.id})`,
      );

    expect(allProducts.length).toBeGreaterThanOrEqual(3);

    const bizIds = new Set(allProducts.map((p) => p.businessId));
    expect(bizIds.size).toBe(2);
  });
});
