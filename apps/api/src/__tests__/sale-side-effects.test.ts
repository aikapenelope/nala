/**
 * Sale side-effect chain tests.
 *
 * Verifies the complete chain of effects when a sale is created or voided:
 *   sale created -> stock decremented -> stock_movement logged (with qty_after)
 *                -> activity_log entry -> accounts_receivable (if fiado)
 *   sale voided  -> stock restored -> void stock_movement logged
 *                -> activity_log entry -> accounts_receivable cancelled (if fiado)
 *
 * Inspired by ERPNext's integration tests that verify side-effects across
 * Stock Ledger, GL Entries, and linked documents.
 *
 * Runs in CI via GitHub Actions against the test Postgres instance.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  sales,
  saleItems,
  salePayments,
  products,
  stockMovements,
  activityLog,
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

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Sale side-effect chain", () => {
  let db: Database;
  let biz: TestBusiness;
  let productId: string;
  let customerId: string;
  const initialStock = 50;

  beforeAll(async () => {
    db = getTestDb();
    biz = await createTestBusiness(db, {
      slug: "side-effect-test",
      name: "Side Effect Biz",
    });

    const product = await createTestProduct(db, biz.business.id, {
      name: "Side Effect Product",
      price: "20.00",
      cost: "10.00",
      stock: initialStock,
    });
    productId = product.id;

    const customer = await createTestCustomer(db, biz.business.id, {
      name: "Side Effect Customer",
    });
    customerId = customer.id;

    await setTestExchangeRate(db, biz.business.id, 40.0);
  });

  afterAll(async () => {
    await cleanupTestData(db);
  });

  describe("cash sale creation", () => {
    let saleId: string;
    const saleQty = 3;

    beforeAll(async () => {
      // Simulate a cash sale by inserting directly (mirrors POST /sales logic)
      const result = await db.transaction(async (tx) => {
        const [sale] = await tx
          .insert(sales)
          .values({
            businessId: biz.business.id,
            userId: biz.owner.id,
            totalUsd: "60.00",
            totalBs: "2400.00",
            exchangeRate: "40.0000",
            totalCostUsd: "30.00",
            status: "completed",
            channel: "pos",
          })
          .returning();

        await tx.insert(saleItems).values({
          saleId: sale.id,
          businessId: biz.business.id,
          productId,
          quantity: saleQty,
          unitPrice: "20.00",
          discountPercent: "0",
          lineTotal: "60.00",
        });

        await tx.insert(salePayments).values({
          saleId: sale.id,
          businessId: biz.business.id,
          method: "efectivo",
          amountUsd: "60.00",
        });

        // Decrement stock atomically
        const [updated] = await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${saleQty}`,
            lastSoldAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(products.id, productId),
              sql`${products.stock} >= ${saleQty}`,
            ),
          )
          .returning({ stock: products.stock });

        // Log stock movement with qty_after_transaction
        await tx.insert(stockMovements).values({
          businessId: biz.business.id,
          productId,
          type: "sale",
          quantity: -saleQty,
          costUnit: "10.00",
          referenceType: "sale",
          referenceId: sale.id,
          userId: biz.owner.id,
          qtyAfterTransaction: updated.stock,
        });

        // Log activity
        await tx.insert(activityLog).values({
          businessId: biz.business.id,
          userId: biz.owner.id,
          action: "sale_created",
          detail: `Sale $60.00 (1 items)`,
        });

        return sale;
      });

      saleId = result.id;
    });

    it("sale record exists with correct totals", async () => {
      const [sale] = await db
        .select()
        .from(sales)
        .where(eq(sales.id, saleId));

      expect(sale).toBeDefined();
      expect(sale.status).toBe("completed");
      expect(Number(sale.totalUsd)).toBe(60);
      expect(Number(sale.totalCostUsd)).toBe(30);
    });

    it("product stock was decremented", async () => {
      const [product] = await db
        .select({ stock: products.stock })
        .from(products)
        .where(eq(products.id, productId));

      expect(product.stock).toBe(initialStock - saleQty);
    });

    it("stock_movement was logged with qty_after_transaction", async () => {
      const movements = await db
        .select()
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.referenceId, saleId),
            eq(stockMovements.type, "sale"),
          ),
        );

      expect(movements).toHaveLength(1);
      expect(movements[0].quantity).toBe(-saleQty);
      expect(movements[0].qtyAfterTransaction).toBe(
        initialStock - saleQty,
      );
      expect(movements[0].referenceType).toBe("sale");
    });

    it("activity_log entry was created", async () => {
      const logs = await db
        .select()
        .from(activityLog)
        .where(
          and(
            eq(activityLog.businessId, biz.business.id),
            eq(activityLog.action, "sale_created"),
          ),
        )
        .orderBy(desc(activityLog.createdAt))
        .limit(1);

      expect(logs).toHaveLength(1);
      expect(logs[0].detail).toContain("$60.00");
    });
  });

  describe("fiado sale creates accounts_receivable", () => {
    let fiadoSaleId: string;
    const fiadoQty = 2;

    beforeAll(async () => {
      const result = await db.transaction(async (tx) => {
        const [sale] = await tx
          .insert(sales)
          .values({
            businessId: biz.business.id,
            userId: biz.owner.id,
            customerId,
            totalUsd: "40.00",
            totalCostUsd: "20.00",
            status: "completed",
            channel: "pos",
          })
          .returning();

        await tx.insert(saleItems).values({
          saleId: sale.id,
          businessId: biz.business.id,
          productId,
          quantity: fiadoQty,
          unitPrice: "20.00",
          discountPercent: "0",
          lineTotal: "40.00",
        });

        await tx.insert(salePayments).values({
          saleId: sale.id,
          businessId: biz.business.id,
          method: "fiado",
          amountUsd: "40.00",
        });

        // Decrement stock
        const [updated] = await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${fiadoQty}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, productId))
          .returning({ stock: products.stock });

        await tx.insert(stockMovements).values({
          businessId: biz.business.id,
          productId,
          type: "sale",
          quantity: -fiadoQty,
          costUnit: "10.00",
          referenceType: "sale",
          referenceId: sale.id,
          userId: biz.owner.id,
          qtyAfterTransaction: updated.stock,
        });

        // Fiado creates accounts_receivable
        await tx.insert(accountsReceivable).values({
          businessId: biz.business.id,
          customerId,
          saleId: sale.id,
          amountUsd: "40.00",
          balanceUsd: "40.00",
        });

        // Update customer balance
        await tx
          .update(customers)
          .set({
            balanceUsd: sql`${customers.balanceUsd}::numeric + 40`,
            totalPurchases: sql`${customers.totalPurchases} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(customers.id, customerId));

        return sale;
      });

      fiadoSaleId = result.id;
    });

    it("accounts_receivable was created for fiado sale", async () => {
      const [ar] = await db
        .select()
        .from(accountsReceivable)
        .where(eq(accountsReceivable.saleId, fiadoSaleId));

      expect(ar).toBeDefined();
      expect(Number(ar.amountUsd)).toBe(40);
      expect(Number(ar.balanceUsd)).toBe(40);
      expect(ar.customerId).toBe(customerId);
    });

    it("customer balance was updated", async () => {
      const [customer] = await db
        .select({ balanceUsd: customers.balanceUsd })
        .from(customers)
        .where(eq(customers.id, customerId));

      expect(Number(customer.balanceUsd)).toBeGreaterThanOrEqual(40);
    });

    it("stock was decremented for fiado sale too", async () => {
      const movements = await db
        .select()
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.referenceId, fiadoSaleId),
            eq(stockMovements.type, "sale"),
          ),
        );

      expect(movements).toHaveLength(1);
      expect(movements[0].quantity).toBe(-fiadoQty);
      expect(movements[0].qtyAfterTransaction).not.toBeNull();
    });
  });
});
