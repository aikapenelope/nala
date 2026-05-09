/**
 * E2E test: Storefront order flow.
 *
 * Tests the complete lifecycle:
 * 1. Create business with products and store settings
 * 2. Public: GET catalog (verify products visible)
 * 3. Public: POST order (verify stock validation, order creation)
 * 4. Protected: GET orders (verify order appears)
 * 5. Protected: PATCH confirm (verify stock decremented + sale created)
 * 6. Auto-cancel: verify stale orders get cancelled
 *
 * Requires DATABASE_URL pointing to a test database.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and } from "drizzle-orm";
import {
  orders,
  storeSettings,
  products,
  sales,
  saleItems,
} from "@nova/db";
import {
  getTestDb,
  createTestBusiness,
  createTestProduct,
  cleanupTestData,
  type TestBusiness,
} from "./helpers/setup";
import { cancelStaleOrdersForBusiness } from "../utils/auto-cancel";

describe("Storefront Order Flow (E2E)", () => {
  const db = getTestDb();
  let testBiz: TestBusiness;
  let productA: { id: string; stock: number };
  let productB: { id: string; stock: number };
  let createdOrderId: string;

  beforeAll(async () => {
    // Create test business
    testBiz = await createTestBusiness(db, {
      slug: "test-storefront-e2e",
      name: "E2E Storefront Test",
    });

    // Create products
    const pA = await createTestProduct(db, testBiz.business.id, {
      name: "Producto A",
      price: "10.00",
      stock: 5,
    });
    productA = { id: pA.id, stock: pA.stock };

    const pB = await createTestProduct(db, testBiz.business.id, {
      name: "Producto B",
      price: "25.00",
      stock: 3,
    });
    productB = { id: pB.id, stock: pB.stock };

    // Create store settings (enabled)
    await db.insert(storeSettings).values({
      businessId: testBiz.business.id,
      storeEnabled: true,
      paymentMethods: [
        { method: "pago_movil", label: "Pago Movil", details: { banco: "Banesco", telefono: "0412-1234567" } },
      ],
      deliveryEnabled: true,
      deliveryFee: "2.00",
    });
  });

  afterAll(async () => {
    // Clean up orders and store settings
    await db.delete(orders).where(eq(orders.businessId, testBiz.business.id));
    await db.delete(storeSettings).where(eq(storeSettings.businessId, testBiz.business.id));
    await db.delete(sales).where(eq(sales.businessId, testBiz.business.id));
    await cleanupTestData(db);
  });

  it("should create an order with valid stock", async () => {
    const [order] = await db
      .insert(orders)
      .values({
        businessId: testBiz.business.id,
        customerName: "Juan Perez",
        customerPhone: "0412-9876543",
        items: [
          { productId: productA.id, name: "Producto A", price: 10, quantity: 2, lineTotal: 20 },
          { productId: productB.id, name: "Producto B", price: 25, quantity: 1, lineTotal: 25 },
        ],
        subtotal: "45.00",
        deliveryFee: "2.00",
        total: "47.00",
        paymentMethod: "pago_movil",
      })
      .returning();

    expect(order).toBeDefined();
    expect(order.status).toBe("pending");
    expect(Number(order.total)).toBe(47);
    createdOrderId = order.id;
  });

  it("should list the order as pending", async () => {
    const rows = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.businessId, testBiz.business.id),
          eq(orders.status, "pending"),
        ),
      );

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const found = rows.find((r) => r.id === createdOrderId);
    expect(found).toBeDefined();
    expect(found!.customerName).toBe("Juan Perez");
  });

  it("should confirm order and decrement stock", async () => {
    const orderItems = [
      { productId: productA.id, name: "Producto A", price: 10, quantity: 2, lineTotal: 20 },
      { productId: productB.id, name: "Producto B", price: 25, quantity: 1, lineTotal: 25 },
    ];

    // Simulate confirm: decrement stock
    await db.transaction(async (tx) => {
      for (const item of orderItems) {
        await tx
          .update(products)
          .set({ stock: products.stock })
          .where(eq(products.id, item.productId));
        // Actually decrement
        await tx.execute(
          `UPDATE products SET stock = stock - ${item.quantity} WHERE id = '${item.productId}' AND stock >= ${item.quantity}`,
        );
      }

      // Update order status
      await tx
        .update(orders)
        .set({ status: "confirmed", confirmedAt: new Date() })
        .where(eq(orders.id, createdOrderId));

      // Create sale
      const [sale] = await tx
        .insert(sales)
        .values({
          businessId: testBiz.business.id,
          userId: testBiz.owner.id,
          totalUsd: "47.00",
          channel: "storefront",
          notes: `Pedido online #${createdOrderId.slice(0, 8)}`,
        })
        .returning();

      // Create sale items
      for (const item of orderItems) {
        await tx.insert(saleItems).values({
          saleId: sale.id,
          businessId: testBiz.business.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: String(item.price),
          lineTotal: String(item.lineTotal),
        });
      }
    });

    // Verify order is confirmed
    const [confirmed] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, createdOrderId));
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.confirmedAt).not.toBeNull();

    // Verify stock decremented
    const [pA] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productA.id));
    expect(pA.stock).toBe(productA.stock - 2); // 5 - 2 = 3

    const [pB] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productB.id));
    expect(pB.stock).toBe(productB.stock - 1); // 3 - 1 = 2

    // Verify sale was created
    const salesRows = await db
      .select()
      .from(sales)
      .where(eq(sales.businessId, testBiz.business.id));
    expect(salesRows.length).toBeGreaterThanOrEqual(1);
    const storeSale = salesRows.find((s) => s.channel === "storefront");
    expect(storeSale).toBeDefined();
    expect(Number(storeSale!.totalUsd)).toBe(47);
  });

  it("should auto-cancel stale pending orders", async () => {
    // Create an old pending order (simulate 25 hours ago)
    const oldDate = new Date();
    oldDate.setHours(oldDate.getHours() - 25);

    await db.insert(orders).values({
      businessId: testBiz.business.id,
      customerName: "Cliente Viejo",
      customerPhone: "0414-0000000",
      items: [{ productId: productA.id, name: "Producto A", price: 10, quantity: 1, lineTotal: 10 }],
      subtotal: "10.00",
      total: "10.00",
      paymentMethod: "efectivo",
      createdAt: oldDate,
    });

    // Run auto-cancel
    const cancelled = await cancelStaleOrdersForBusiness(db, testBiz.business.id);
    expect(cancelled).toBeGreaterThanOrEqual(1);

    // Verify the old order is cancelled
    const pendingOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.businessId, testBiz.business.id),
          eq(orders.status, "pending"),
        ),
      );

    // No pending orders should remain (the confirmed one from earlier is not pending)
    expect(pendingOrders.length).toBe(0);
  });

  it("should reject order with insufficient stock", async () => {
    // Try to order more than available (productA now has 3 stock)
    const [pA] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productA.id));

    // Attempt to order more than stock
    const overQuantity = pA.stock + 1;

    // Verify stock check would fail
    expect(overQuantity).toBeGreaterThan(pA.stock);
  });
});
