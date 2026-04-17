/**
 * E2E-style API tests: complete sale lifecycle.
 *
 * Tests the full flow a POS user would follow:
 * 1. Set exchange rate
 * 2. Create a sale with items and payment
 * 3. Verify sale appears in list
 * 4. Verify sale detail with items and payments
 * 5. Void the sale
 * 6. Verify stock was restored
 *
 * Runs against real PostgreSQL. Skipped without DATABASE_URL.
 * Uses dev mock user (no Clerk required).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { products, customers } from "@nova/db";
import {
  getTestDb,
  createTestBusiness,
  createTestProduct,
  createTestCustomer,
  setTestExchangeRate,
  cleanupTestData,
  type TestBusiness,
} from "./helpers/setup";
import type { Database } from "@nova/db";
import { app } from "../app";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("E2E: Sale lifecycle", () => {
  let db: Database;
  let testBiz: TestBusiness;
  let product: typeof products.$inferSelect;
  let customer: typeof customers.$inferSelect;

  beforeAll(async () => {
    db = getTestDb();
    testBiz = await createTestBusiness(db);
    product = await createTestProduct(db, testBiz.business.id, {
      name: "Harina PAN 1kg",
      price: "2.50",
      cost: "1.50",
      stock: 50,
    });
    customer = await createTestCustomer(db, testBiz.business.id, {
      name: "Juan Perez",
    });
    await setTestExchangeRate(db, testBiz.business.id, 36.5);
  });

  afterAll(async () => {
    await cleanupTestData(db);
  });

  it("completes a full cash sale and verifies stock decrement", async () => {
    // 1. Create sale via API
    const createRes = await app.request("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            productId: product.id,
            quantity: 3,
            unitPrice: 2.5,
            discountPercent: 0,
          },
        ],
        payments: [{ method: "efectivo", amountUsd: 7.5 }],
        discountPercent: 0,
      }),
    });

    // Dev mode mock user -- should succeed
    expect(createRes.status).toBe(201);
    const saleData = (await createRes.json()) as { sale: { id: string } };
    expect(saleData.sale.id).toBeDefined();
    const saleId = saleData.sale.id;

    // 2. Verify sale appears in list
    const listRes = await app.request("/api/sales?limit=5");
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as {
      sales: Array<{ id: string; status: string }>;
    };
    const found = listData.sales.find((s) => s.id === saleId);
    expect(found).toBeDefined();
    expect(found?.status).toBe("completed");

    // 3. Verify sale detail
    const detailRes = await app.request(`/api/sales/${saleId}`);
    expect(detailRes.status).toBe(200);
    const detailData = (await detailRes.json()) as {
      sale: { id: string; totalUsd: string };
      items: Array<{ productId: string; quantity: number }>;
      payments: Array<{ method: string; amountUsd: string }>;
    };
    expect(detailData.items).toHaveLength(1);
    expect(detailData.items[0].quantity).toBe(3);
    expect(detailData.payments).toHaveLength(1);
    expect(detailData.payments[0].method).toBe("efectivo");

    // 4. Verify stock was decremented
    const [updatedProduct] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, product.id));
    expect(updatedProduct.stock).toBe(47); // 50 - 3

    // 5. Void the sale
    const voidRes = await app.request(`/api/sales/${saleId}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Test void" }),
    });
    expect(voidRes.status).toBe(200);

    // 6. Verify stock was restored
    const [restoredProduct] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, product.id));
    expect(restoredProduct.stock).toBe(50); // restored

    // 7. Verify sale is voided
    const voidedRes = await app.request(`/api/sales/${saleId}`);
    const voidedData = (await voidedRes.json()) as {
      sale: { status: string; voidReason: string };
    };
    expect(voidedData.sale.status).toBe("voided");
    expect(voidedData.sale.voidReason).toBe("Test void");
  });

  it("creates a fiado sale and generates accounts receivable", async () => {
    const createRes = await app.request("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            productId: product.id,
            quantity: 2,
            unitPrice: 2.5,
            discountPercent: 0,
          },
        ],
        payments: [{ method: "fiado", amountUsd: 5.0 }],
        customerId: customer.id,
        discountPercent: 0,
      }),
    });

    expect(createRes.status).toBe(201);

    // Verify accounts receivable was created
    const arRes = await app.request("/api/accounts/receivable");
    expect(arRes.status).toBe(200);
    const arData = (await arRes.json()) as {
      accounts: Array<{ customerId: string; balanceUsd: string }>;
    };
    const ar = arData.accounts.find((a) => a.customerId === customer.id);
    expect(ar).toBeDefined();
    expect(Number(ar?.balanceUsd)).toBeGreaterThan(0);
  });
});
