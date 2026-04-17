/**
 * E2E-style API tests: inventory and customer management.
 *
 * Tests the flows a store owner would follow:
 * - List, create, update products
 * - Search products
 * - List, create, update customers
 * - Customer segments recalculation
 *
 * Runs against real PostgreSQL. Skipped without DATABASE_URL.
 * Uses dev mock user (no Clerk required).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getTestDb,
  createTestBusiness,
  cleanupTestData,
} from "./helpers/setup";
import type { Database } from "@nova/db";
import { app } from "../app";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("E2E: Inventory management", () => {
  let db: Database;
  beforeAll(async () => {
    db = getTestDb();
    await createTestBusiness(db);
  });

  afterAll(async () => {
    await cleanupTestData(db);
  });

  it("creates a product and finds it in the list", async () => {
    // Create product
    const createRes = await app.request("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Aceite Diana 1L",
        price: 4.0,
        cost: 2.5,
        stock: 30,
        stockMin: 5,
        stockCritical: 2,
      }),
    });

    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      product: { id: string; name: string };
    };
    expect(created.product.name).toBe("Aceite Diana 1L");
    const productId = created.product.id;

    // List products and find it
    const listRes = await app.request("/api/products?limit=50");
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as {
      products: Array<{ id: string; name: string }>;
    };
    expect(listData.products.some((p) => p.id === productId)).toBe(true);
  });

  it("updates a product price and stock", async () => {
    // Create
    const createRes = await app.request("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Harina PAN 1kg",
        price: 2.5,
        cost: 1.5,
        stock: 50,
      }),
    });
    const { product } = (await createRes.json()) as {
      product: { id: string };
    };

    // Update
    const updateRes = await app.request(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: 3.0, stock: 60 }),
    });

    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as {
      product: { price: string; stock: number };
    };
    expect(Number(updated.product.price)).toBe(3.0);
    expect(updated.product.stock).toBe(60);
  });

  it("searches products by name", async () => {
    // Create two products
    await app.request("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Cafe Madrid 500g", price: 5.0, cost: 3.0, stock: 20 }),
    });
    await app.request("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Azucar Montalbán 1kg", price: 1.5, cost: 0.8, stock: 40 }),
    });

    // Search for "Cafe"
    const searchRes = await app.request("/api/products?search=Cafe");
    expect(searchRes.status).toBe(200);
    const searchData = (await searchRes.json()) as {
      products: Array<{ name: string }>;
    };
    expect(searchData.products.length).toBeGreaterThanOrEqual(1);
    expect(searchData.products.every((p) => p.name.includes("Cafe"))).toBe(true);
  });
});

describe.skipIf(!hasDb)("E2E: Customer management", () => {
  let db: Database;
  beforeAll(async () => {
    db = getTestDb();
    await createTestBusiness(db);
  });

  afterAll(async () => {
    await cleanupTestData(db);
  });

  it("creates a customer and retrieves their detail", async () => {
    const createRes = await app.request("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Maria Garcia",
        phone: "+58412-555-1234",
        email: "maria@example.com",
      }),
    });

    expect(createRes.status).toBe(201);
    const { customer } = (await createRes.json()) as {
      customer: { id: string; name: string };
    };
    expect(customer.name).toBe("Maria Garcia");

    // Get detail
    const detailRes = await app.request(`/api/customers/${customer.id}`);
    expect(detailRes.status).toBe(200);
    const detail = (await detailRes.json()) as {
      customer: { name: string; phone: string; segments: string[] };
      receivables: unknown[];
    };
    expect(detail.customer.name).toBe("Maria Garcia");
    expect(detail.customer.phone).toBe("+58412-555-1234");
    expect(Array.isArray(detail.customer.segments)).toBe(true);
    expect(Array.isArray(detail.receivables)).toBe(true);
  });

  it("updates a customer and verifies changes", async () => {
    const createRes = await app.request("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Pedro Lopez" }),
    });
    const { customer } = (await createRes.json()) as {
      customer: { id: string };
    };

    const updateRes = await app.request(`/api/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Pedro Lopez Jr",
        notes: "Cliente frecuente",
      }),
    });

    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as {
      customer: { name: string; notes: string };
    };
    expect(updated.customer.name).toBe("Pedro Lopez Jr");
    expect(updated.customer.notes).toBe("Cliente frecuente");
  });

  it("lists customers with segments included", async () => {
    // Create a customer
    await app.request("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ana Rodriguez" }),
    });

    const listRes = await app.request("/api/customers?limit=10");
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as {
      customers: Array<{ name: string; segments: string[] }>;
      total: number;
    };
    expect(listData.total).toBeGreaterThanOrEqual(1);
    // Every customer should have a segments array (may be empty)
    for (const c of listData.customers) {
      expect(Array.isArray(c.segments)).toBe(true);
    }
  });

  it("recalculates customer segments", async () => {
    const res = await app.request("/api/customers/recalculate-segments", {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      customersProcessed: number;
      segmentsAssigned: number;
    };
    expect(data.customersProcessed).toBeGreaterThanOrEqual(0);
    expect(typeof data.segmentsAssigned).toBe("number");
  });
});
