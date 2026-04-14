/**
 * Sales integration tests.
 *
 * Tests run against a real PostgreSQL database.
 * Requires DATABASE_URL and REDIS_URL environment variables.
 *
 * Covers:
 * - Sale creation with stock decrement
 * - Sale with fiado creates accounts_receivable
 * - Sale void restores stock
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and } from "drizzle-orm";
import {
  products,
  sales,
  saleItems,
  salePayments,
  accountsReceivable,
  customers,
} from "@nova/db";
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

// Skip if no DATABASE_URL (local dev without DB)
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Sales integration", () => {
  let db: Database;
  let testBiz: TestBusiness;
  let productA: typeof products.$inferSelect;
  let productB: typeof products.$inferSelect;
  let customer: typeof customers.$inferSelect;

  beforeAll(async () => {
    db = getTestDb();
    testBiz = await createTestBusiness(db);
    productA = await createTestProduct(db, testBiz.business.id, {
      name: "Harina PAN",
      price: "2.50",
      cost: "1.50",
      stock: 50,
    });
    productB = await createTestProduct(db, testBiz.business.id, {
      name: "Aceite Diana",
      price: "4.00",
      cost: "2.50",
      stock: 30,
    });
    customer = await createTestCustomer(db, testBiz.business.id, {
      name: "Maria Garcia",
    });
    await setTestExchangeRate(db, testBiz.business.id, 36.5);
  });

  afterAll(async () => {
    await cleanupTestData(db);
  });

  it("creates a cash sale and decrements stock", async () => {
    const bizId = testBiz.business.id;
    const userId = testBiz.owner.id;

    // Create sale directly via DB (simulating what POST /sales does)
    const totalUsd = 2.5 * 3; // 3 units of Harina PAN
    const result = await db.transaction(async (tx) => {
      const [sale] = await tx
        .insert(sales)
        .values({
          businessId: bizId,
          userId,
          totalUsd: String(totalUsd),
          totalBs: String(totalUsd * 36.5),
          exchangeRate: "36.5",
          status: "completed",
        })
        .returning();

      await tx.insert(saleItems).values({
        saleId: sale.id,
        productId: productA.id,
        quantity: 3,
        unitPrice: "2.50",
        lineTotal: "7.50",
      });

      await tx.insert(salePayments).values({
        saleId: sale.id,
        method: "efectivo",
        amountUsd: String(totalUsd),
        exchangeRate: "36.5",
      });

      // Decrement stock
      await tx.execute(
        `UPDATE products SET stock = stock - 3, last_sold_at = NOW(), updated_at = NOW() WHERE id = '${productA.id}'`,
      );

      return sale;
    });

    expect(result.id).toBeDefined();
    expect(result.status).toBe("completed");

    // Verify stock was decremented
    const [updatedProduct] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productA.id));

    expect(updatedProduct.stock).toBe(47); // 50 - 3
  });

  it("creates a fiado sale and generates accounts_receivable", async () => {
    const bizId = testBiz.business.id;
    const userId = testBiz.owner.id;
    const fiadoAmount = 4.0 * 2; // 2 units of Aceite Diana

    const result = await db.transaction(async (tx) => {
      const [sale] = await tx
        .insert(sales)
        .values({
          businessId: bizId,
          userId,
          customerId: customer.id,
          totalUsd: String(fiadoAmount),
          totalBs: String(fiadoAmount * 36.5),
          exchangeRate: "36.5",
          status: "completed",
        })
        .returning();

      await tx.insert(saleItems).values({
        saleId: sale.id,
        productId: productB.id,
        quantity: 2,
        unitPrice: "4.00",
        lineTotal: "8.00",
      });

      await tx.insert(salePayments).values({
        saleId: sale.id,
        method: "fiado",
        amountUsd: String(fiadoAmount),
        exchangeRate: "36.5",
      });

      // Decrement stock
      await tx.execute(
        `UPDATE products SET stock = stock - 2, last_sold_at = NOW(), updated_at = NOW() WHERE id = '${productB.id}'`,
      );

      // Create accounts_receivable
      await tx.insert(accountsReceivable).values({
        businessId: bizId,
        customerId: customer.id,
        saleId: sale.id,
        amountUsd: String(fiadoAmount),
        balanceUsd: String(fiadoAmount),
      });

      // Update customer balance
      await tx.execute(
        `UPDATE customers SET balance_usd = balance_usd::numeric + ${fiadoAmount}, total_purchases = total_purchases + 1, total_spent_usd = total_spent_usd::numeric + ${fiadoAmount}, last_purchase_at = NOW(), updated_at = NOW() WHERE id = '${customer.id}'`,
      );

      return sale;
    });

    expect(result.customerId).toBe(customer.id);

    // Verify accounts_receivable was created
    const [ar] = await db
      .select()
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.saleId, result.id),
          eq(accountsReceivable.customerId, customer.id),
        ),
      );

    expect(ar).toBeDefined();
    expect(Number(ar.amountUsd)).toBe(fiadoAmount);
    expect(Number(ar.balanceUsd)).toBe(fiadoAmount);
    expect(ar.status).toBe("pending");

    // Verify customer balance was updated
    const [updatedCustomer] = await db
      .select({ balanceUsd: customers.balanceUsd })
      .from(customers)
      .where(eq(customers.id, customer.id));

    expect(Number(updatedCustomer.balanceUsd)).toBe(fiadoAmount);

    // Verify stock was decremented
    const [updatedProduct] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productB.id));

    expect(updatedProduct.stock).toBe(28); // 30 - 2
  });

  it("voids a sale and restores stock", async () => {
    const bizId = testBiz.business.id;
    const userId = testBiz.owner.id;

    // First create a sale
    const [sale] = await db
      .insert(sales)
      .values({
        businessId: bizId,
        userId,
        totalUsd: "5.00",
        totalBs: "182.50",
        exchangeRate: "36.5",
        status: "completed",
      })
      .returning();

    await db.insert(saleItems).values({
      saleId: sale.id,
      productId: productA.id,
      quantity: 2,
      unitPrice: "2.50",
      lineTotal: "5.00",
    });

    await db.insert(salePayments).values({
      saleId: sale.id,
      method: "efectivo",
      amountUsd: "5.00",
    });

    // Decrement stock
    await db.execute(
      `UPDATE products SET stock = stock - 2, updated_at = NOW() WHERE id = '${productA.id}'`,
    );

    // Get stock before void
    const [beforeVoid] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productA.id));

    const stockBeforeVoid = beforeVoid.stock;

    // Void the sale: restore stock + mark as voided
    await db.transaction(async (tx) => {
      // Get items to restore
      const items = await tx
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, sale.id));

      for (const item of items) {
        await tx.execute(
          `UPDATE products SET stock = stock + ${item.quantity}, updated_at = NOW() WHERE id = '${item.productId}'`,
        );
      }

      await tx.execute(
        `UPDATE sales SET status = 'voided', void_reason = 'Test void', voided_by = '${userId}', updated_at = NOW() WHERE id = '${sale.id}'`,
      );
    });

    // Verify sale is voided
    const [voidedSale] = await db
      .select({ status: sales.status, voidReason: sales.voidReason })
      .from(sales)
      .where(eq(sales.id, sale.id));

    expect(voidedSale.status).toBe("voided");
    expect(voidedSale.voidReason).toBe("Test void");

    // Verify stock was restored
    const [afterVoid] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productA.id));

    expect(afterVoid.stock).toBe(stockBeforeVoid + 2);
  });
});
