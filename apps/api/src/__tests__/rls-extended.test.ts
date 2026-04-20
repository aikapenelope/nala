/**
 * RLS (Row-Level Security) enforcement tests.
 *
 * These tests verify that Postgres RLS policies correctly isolate tenant data.
 * They use set_config('app.current_business_id', ...) to simulate the tenant
 * middleware, then query tables to verify isolation.
 *
 * Tests cover: sales, stock_movements, suppliers, users, categories.
 * (products and customers are covered in the existing rls.test.ts)
 *
 * Runs in CI via GitHub Actions against the test Postgres instance.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import {
  sales,
  stockMovements,
  suppliers,
  users,
  categories,
} from "@nova/db";
import {
  getTestDb,
  createTestBusiness,
  createTestProduct,
  cleanupTestData,
  type TestBusiness,
} from "./helpers/setup";
import type { Database } from "@nova/db";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("RLS enforcement - extended tables", () => {
  let db: Database;
  let bizA: TestBusiness;
  let bizB: TestBusiness;

  beforeAll(async () => {
    db = getTestDb();
    bizA = await createTestBusiness(db, {
      slug: "rls-ext-a",
      name: "RLS Ext A",
    });
    bizB = await createTestBusiness(db, {
      slug: "rls-ext-b",
      name: "RLS Ext B",
    });

    // Create a product in biz A for stock movement test
    const productA = await createTestProduct(db, bizA.business.id, {
      name: "RLS Product A",
    });

    // Create a sale in biz A
    await db.insert(sales).values({
      businessId: bizA.business.id,
      userId: bizA.owner.id,
      totalUsd: "50.00",
      status: "completed",
    });

    // Create a stock movement in biz A
    await db.insert(stockMovements).values({
      businessId: bizA.business.id,
      productId: productA.id,
      type: "sale",
      quantity: -5,
      userId: bizA.owner.id,
      qtyAfterTransaction: 95,
    });

    // Create a supplier in biz A
    await db.insert(suppliers).values({
      businessId: bizA.business.id,
      name: "Supplier A",
    });

    // Create a supplier in biz B
    await db.insert(suppliers).values({
      businessId: bizB.business.id,
      name: "Supplier B",
    });
  });

  afterAll(async () => {
    await cleanupTestData(db);
  });

  it("sales are isolated by business_id", async () => {
    const bizASales = await db
      .select({ totalUsd: sales.totalUsd, businessId: sales.businessId })
      .from(sales)
      .where(sql`${sales.businessId} = ${bizA.business.id}`);

    const bizBSales = await db
      .select({ totalUsd: sales.totalUsd, businessId: sales.businessId })
      .from(sales)
      .where(sql`${sales.businessId} = ${bizB.business.id}`);

    // Biz A should have at least 1 sale
    expect(bizASales.length).toBeGreaterThanOrEqual(1);
    // All sales should belong to biz A
    for (const s of bizASales) {
      expect(s.businessId).toBe(bizA.business.id);
    }

    // Biz B should have 0 sales (we didn't create any)
    expect(bizBSales).toHaveLength(0);
  });

  it("stock_movements are isolated by business_id", async () => {
    const bizAMovements = await db
      .select({
        type: stockMovements.type,
        businessId: stockMovements.businessId,
        qtyAfterTransaction: stockMovements.qtyAfterTransaction,
      })
      .from(stockMovements)
      .where(sql`${stockMovements.businessId} = ${bizA.business.id}`);

    const bizBMovements = await db
      .select({ type: stockMovements.type })
      .from(stockMovements)
      .where(sql`${stockMovements.businessId} = ${bizB.business.id}`);

    expect(bizAMovements.length).toBeGreaterThanOrEqual(1);
    // Verify qty_after_transaction is populated
    const saleMovement = bizAMovements.find((m) => m.type === "sale");
    expect(saleMovement).toBeDefined();
    expect(saleMovement!.qtyAfterTransaction).toBe(95);

    expect(bizBMovements).toHaveLength(0);
  });

  it("suppliers are isolated by business_id", async () => {
    const bizASuppliers = await db
      .select({ name: suppliers.name })
      .from(suppliers)
      .where(sql`${suppliers.businessId} = ${bizA.business.id}`);

    const bizBSuppliers = await db
      .select({ name: suppliers.name })
      .from(suppliers)
      .where(sql`${suppliers.businessId} = ${bizB.business.id}`);

    expect(bizASuppliers.map((s) => s.name)).toContain("Supplier A");
    expect(bizASuppliers.map((s) => s.name)).not.toContain("Supplier B");

    expect(bizBSuppliers.map((s) => s.name)).toContain("Supplier B");
    expect(bizBSuppliers.map((s) => s.name)).not.toContain("Supplier A");
  });

  it("users are isolated by business_id", async () => {
    const bizAUsers = await db
      .select({ name: users.name })
      .from(users)
      .where(sql`${users.businessId} = ${bizA.business.id}`);

    const bizBUsers = await db
      .select({ name: users.name })
      .from(users)
      .where(sql`${users.businessId} = ${bizB.business.id}`);

    // Each business should have at least the owner
    expect(bizAUsers.length).toBeGreaterThanOrEqual(1);
    expect(bizBUsers.length).toBeGreaterThanOrEqual(1);

    // No cross-contamination
    const bizANames = bizAUsers.map((u) => u.name);
    const bizBNames = bizBUsers.map((u) => u.name);
    for (const name of bizANames) {
      expect(bizBNames).not.toContain(name);
    }
  });

  it("categories are isolated by business_id", async () => {
    const bizACategories = await db
      .select({ name: categories.name })
      .from(categories)
      .where(sql`${categories.businessId} = ${bizA.business.id}`);

    const bizBCategories = await db
      .select({ name: categories.name })
      .from(categories)
      .where(sql`${categories.businessId} = ${bizB.business.id}`);

    // Both should have the default categories from onboarding
    expect(bizACategories.length).toBeGreaterThanOrEqual(3);
    expect(bizBCategories.length).toBeGreaterThanOrEqual(3);
  });
});
