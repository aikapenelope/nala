/**
 * E2E test: Storefront checkout flow via HTTP API.
 *
 * Tests the complete public checkout lifecycle through actual HTTP endpoints:
 * 1. Setup: Create business, products, store settings, exchange rate
 * 2. GET /catalog/:slug — verify products are visible publicly
 * 3. POST /catalog/:slug/orders — create order (validates prices server-side)
 * 4. POST /catalog/:slug/orders — idempotency key prevents duplicates
 * 5. POST /catalog/:slug/orders — reject when stock insufficient
 * 6. POST /catalog/:slug/orders — reject when price mismatch
 * 7. POST /catalog/:slug/orders — reject below minimum order amount
 * 8. GET /api/orders — verify order appears (authenticated)
 * 9. PATCH /api/orders/:id/confirm — confirm order, verify stock decremented
 * 10. PATCH /api/orders/:id/cancel — cancel confirmed order, verify stock restored
 *
 * Runs against real PostgreSQL in CI (GitHub Actions).
 * Uses dev mock user for authenticated endpoints (no Clerk required).
 *
 * Requires: DATABASE_URL pointing to a test database with migrations applied.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and } from "drizzle-orm";
import {
  orders,
  storeSettings,
  products,
  sales,
  saleItems,
  salePayments,
  stockMovements,
  customers,
} from "@nova/db";
import {
  getTestDb,
  createTestBusiness,
  createTestProduct,
  setTestExchangeRate,
  cleanupTestData,
  type TestBusiness,
} from "./helpers/setup";
import type { Database } from "@nova/db";
import { app } from "../app";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("E2E: Storefront Checkout Flow (HTTP)", () => {
  let db: Database;
  let testBiz: TestBusiness;
  let productA: typeof products.$inferSelect;
  let productB: typeof products.$inferSelect;
  const SLUG = `checkout-e2e-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    db = getTestDb();

    // Create business with a unique slug
    testBiz = await createTestBusiness(db, {
      slug: SLUG,
      name: "Checkout E2E Store",
    });

    // Create products with known prices and stock
    productA = await createTestProduct(db, testBiz.business.id, {
      name: "Arroz 1kg",
      price: "3.50",
      cost: "2.00",
      stock: 10,
    });

    productB = await createTestProduct(db, testBiz.business.id, {
      name: "Aceite 1L",
      price: "5.00",
      cost: "3.00",
      stock: 4,
    });

    // Enable store with payment methods and delivery
    await db.insert(storeSettings).values({
      businessId: testBiz.business.id,
      storeEnabled: true,
      paymentMethods: [
        {
          method: "pago_movil",
          label: "Pago Movil",
          details: { banco: "Banesco", telefono: "0412-1234567" },
        },
      ],
      deliveryEnabled: true,
      deliveryFee: "1.50",
      minOrderAmount: "5.00",
    });

    // Set exchange rate (required for Bs display)
    await setTestExchangeRate(db, testBiz.business.id, 36.5);
  });

  afterAll(async () => {
    if (!db) return;
    // Clean up in dependency order
    await db.delete(stockMovements).where(eq(stockMovements.businessId, testBiz.business.id));
    await db.delete(salePayments).where(eq(salePayments.businessId, testBiz.business.id));
    await db.delete(saleItems).where(eq(saleItems.businessId, testBiz.business.id));
    await db.delete(sales).where(eq(sales.businessId, testBiz.business.id));
    await db.delete(orders).where(eq(orders.businessId, testBiz.business.id));
    await db.delete(storeSettings).where(eq(storeSettings.businessId, testBiz.business.id));
    await db.delete(customers).where(eq(customers.businessId, testBiz.business.id));
    await cleanupTestData(db);
  });

  // ================================================================
  // 1. Public catalog is accessible
  // ================================================================

  it("GET /catalog/:slug returns products publicly", async () => {
    const res = await app.request(`/catalog/${SLUG}`);
    expect(res.status).toBe(200);

    const body = await res.json() as {
      business: { name: string };
      products: Array<{ id: string; name: string; price: number; available: boolean }>;
      exchangeRate: number | null;
    };

    expect(body.business.name).toBe("Checkout E2E Store");
    expect(body.products.length).toBe(2);
    expect(body.exchangeRate).toBeCloseTo(36.5, 1);

    // Products should have correct prices
    const arroz = body.products.find((p) => p.name === "Arroz 1kg");
    expect(arroz).toBeDefined();
    expect(arroz!.price).toBe(3.5);
    expect(arroz!.available).toBe(true);
  });

  // ================================================================
  // 2. Create a valid order
  // ================================================================

  let orderId: string;

  it("POST /catalog/:slug/orders creates order with server-validated prices", async () => {
    const res = await app.request(`/catalog/${SLUG}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Maria Garcia",
        customerPhone: "0414-5551234",
        customerNotes: "Dejar en porteria",
        items: [
          { productId: productA.id, name: "Arroz 1kg", price: 3.5, quantity: 2, lineTotal: 7 },
          { productId: productB.id, name: "Aceite 1L", price: 5, quantity: 1, lineTotal: 5 },
        ],
        paymentMethod: "pago_movil",
        paymentReference: "REF-12345",
        deliveryRequested: true,
        idempotencyKey: "test-idem-001",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { orderId: string; waLink: string | null; message: string };
    expect(body.orderId).toBeDefined();
    expect(body.message).toBe("Pedido creado exitosamente");
    orderId = body.orderId;
  });

  // ================================================================
  // 3. Idempotency: same key returns same order
  // ================================================================

  it("POST /catalog/:slug/orders with same idempotency key returns existing order", async () => {
    const res = await app.request(`/catalog/${SLUG}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Maria Garcia",
        customerPhone: "0414-5551234",
        items: [
          { productId: productA.id, name: "Arroz 1kg", price: 3.5, quantity: 2, lineTotal: 7 },
        ],
        paymentMethod: "pago_movil",
        idempotencyKey: "test-idem-001",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { orderId: string; message: string };
    // Should return the same order ID (idempotent)
    expect(body.orderId).toBe(orderId);
    expect(body.message).toBe("Pedido ya registrado");
  });

  // ================================================================
  // 4. Reject: price mismatch (client sends wrong price)
  // ================================================================

  it("POST /catalog/:slug/orders rejects price mismatch", async () => {
    const res = await app.request(`/catalog/${SLUG}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Atacante",
        customerPhone: "0412-0000000",
        items: [
          // Client sends $1.00 but DB price is $3.50
          { productId: productA.id, name: "Arroz 1kg", price: 1.0, quantity: 1, lineTotal: 1 },
        ],
        paymentMethod: "pago_movil",
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json() as { error: string; details: string[] };
    expect(body.error).toBe("Precio incorrecto");
    expect(body.details.length).toBeGreaterThan(0);
  });

  // ================================================================
  // 5. Reject: below minimum order amount
  // ================================================================

  it("POST /catalog/:slug/orders rejects below minimum order amount", async () => {
    const res = await app.request(`/catalog/${SLUG}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Pedido Chico",
        customerPhone: "0412-1111111",
        items: [
          // $3.50 * 1 = $3.50, below $5.00 minimum
          { productId: productA.id, name: "Arroz 1kg", price: 3.5, quantity: 1, lineTotal: 3.5 },
        ],
        paymentMethod: "pago_movil",
        deliveryRequested: false,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("Monto minimo");
  });

  // ================================================================
  // 6. Reject: insufficient stock
  // ================================================================

  it("POST /catalog/:slug/orders rejects insufficient stock", async () => {
    const res = await app.request(`/catalog/${SLUG}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Comprador Grande",
        customerPhone: "0412-2222222",
        items: [
          // productB has stock=4, requesting 10
          { productId: productB.id, name: "Aceite 1L", price: 5, quantity: 10, lineTotal: 50 },
        ],
        paymentMethod: "pago_movil",
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json() as { error: string; details: string[] };
    expect(body.error).toBe("Stock insuficiente");
  });

  // ================================================================
  // 7. Authenticated: order appears in list
  // ================================================================

  it("GET /api/orders shows the pending order (authenticated)", async () => {
    const res = await app.request("/api/orders?status=pending");
    expect(res.status).toBe(200);

    const body = await res.json() as { orders: Array<{ id: string; status: string }> };
    const found = body.orders.find((o) => o.id === orderId);
    expect(found).toBeDefined();
    expect(found!.status).toBe("pending");
  });

  // ================================================================
  // 8. Confirm order: stock decremented, sale created
  // ================================================================

  it("PATCH /api/orders/:id/confirm decrements stock and creates sale", async () => {
    const res = await app.request(`/api/orders/${orderId}/confirm`, {
      method: "PATCH",
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; status: string };
    expect(body.success).toBe(true);
    expect(body.status).toBe("confirmed");

    // Verify stock was decremented
    const [pA] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productA.id));
    expect(pA.stock).toBe(10 - 2); // ordered 2

    const [pB] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productB.id));
    expect(pB.stock).toBe(4 - 1); // ordered 1

    // Verify sale was created with correct total
    const [sale] = await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.businessId, testBiz.business.id),
          eq(sales.channel, "storefront"),
        ),
      );
    expect(sale).toBeDefined();
    // Total: (3.50*2 + 5.00*1) + 1.50 delivery = 13.50
    expect(Number(sale.totalUsd)).toBeCloseTo(13.5, 1);

    // Verify stock movements were logged
    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.businessId, testBiz.business.id));
    expect(movements.length).toBeGreaterThanOrEqual(2);

    // Verify customer was created from phone number
    const [cust] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.businessId, testBiz.business.id),
          eq(customers.phone, "0414-5551234"),
        ),
      );
    expect(cust).toBeDefined();
    expect(cust.name).toBe("Maria Garcia");
  });

  // ================================================================
  // 9. Cancel confirmed order: stock restored
  // ================================================================

  it("PATCH /api/orders/:id/cancel restores stock for confirmed order", async () => {
    const res = await app.request(`/api/orders/${orderId}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Cliente no pago" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; status: string };
    expect(body.success).toBe(true);
    expect(body.status).toBe("cancelled");

    // Verify stock was restored
    const [pA] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productA.id));
    expect(pA.stock).toBe(10); // back to original

    const [pB] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productB.id));
    expect(pB.stock).toBe(4); // back to original
  });

  // ================================================================
  // 10. Cannot confirm a cancelled order
  // ================================================================

  it("PATCH /api/orders/:id/confirm rejects cancelled order", async () => {
    const res = await app.request(`/api/orders/${orderId}/confirm`, {
      method: "PATCH",
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("cancelado");
  });
});
