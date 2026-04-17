/**
 * E2E-style API tests: reports, settings, and team management.
 *
 * Tests the flows an owner would follow:
 * - View daily/weekly/financial reports
 * - View cash flow projection
 * - View and update business settings
 * - Manage employees (create, list)
 * - View exchange rate
 *
 * Runs against real PostgreSQL. Skipped without DATABASE_URL.
 * Uses dev mock user (no Clerk required).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getTestDb,
  createTestBusiness,
  createTestProduct,
  setTestExchangeRate,
  cleanupTestData,
} from "./helpers/setup";
import type { Database } from "@nova/db";
import { app } from "../app";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("E2E: Reports", () => {
  let db: Database;
  let bizId: string;
  beforeAll(async () => {
    db = getTestDb();
    const testBiz = await createTestBusiness(db);
    bizId = testBiz.business.id;
    await createTestProduct(db, bizId, {
      name: "Producto Reporte",
      price: "10.00",
      cost: "5.00",
      stock: 100,
    });
    await setTestExchangeRate(db, bizId, 36.5);
  });

  afterAll(async () => {
    await cleanupTestData(db);
  });

  it("GET /reports/daily returns today summary", async () => {
    const res = await app.request("/api/reports/daily");
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      data: {
        totalSales: number;
        totalCount: number;
        avgTicket: number;
      };
      narrative: string;
      period: string;
    };
    expect(typeof data.data.totalSales).toBe("number");
    expect(typeof data.data.totalCount).toBe("number");
    expect(typeof data.narrative).toBe("string");
    expect(data.period).toBe("today");
  });

  it("GET /reports/weekly returns period summary", async () => {
    const res = await app.request("/api/reports/weekly?period=week");
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      data: {
        totalSales: number;
        dailyBreakdown: unknown[];
      };
      narrative: string;
    };
    expect(typeof data.data.totalSales).toBe("number");
    expect(Array.isArray(data.data.dailyBreakdown)).toBe(true);
  });

  it("GET /reports/financial returns P&L data", async () => {
    const res = await app.request("/api/reports/financial?period=month");
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      data: {
        revenue: number;
        costOfGoods: number;
        grossProfit: number;
        expenses: number;
        netProfit: number;
      };
    };
    expect(typeof data.data.revenue).toBe("number");
    expect(typeof data.data.netProfit).toBe("number");
  });

  it("GET /reports/inventory returns stock status", async () => {
    const res = await app.request("/api/reports/inventory");
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      data: {
        totalProducts: number;
        lowStock: number;
        criticalStock: number;
      };
    };
    expect(data.data.totalProducts).toBeGreaterThanOrEqual(1);
  });

  it("GET /reports/profitability returns product analysis", async () => {
    const res = await app.request("/api/reports/profitability");
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      data: { products: unknown[] };
    };
    expect(Array.isArray(data.data.products)).toBe(true);
  });

  it("GET /reports/alerts returns smart alerts array", async () => {
    const res = await app.request("/api/reports/alerts");
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      alerts: Array<{ id: string; severity: string }>;
    };
    expect(Array.isArray(data.alerts)).toBe(true);
  });

  it("GET /reports/sellers returns seller ranking", async () => {
    const res = await app.request("/api/reports/sellers?period=week");
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      data: { sellers: unknown[] };
    };
    expect(Array.isArray(data.data.sellers)).toBe(true);
  });

  it("GET /reports/cash-flow returns projection data", async () => {
    const res = await app.request("/api/reports/cash-flow");
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      data: {
        avgDailyRevenue: number;
        avgDailyExpenses: number;
        pendingReceivable: number;
        pendingPayable: number;
        projection7d: { revenue: number; expenses: number; net: number };
        projection30d: { revenue: number; expenses: number; net: number };
      };
    };
    expect(typeof data.data.avgDailyRevenue).toBe("number");
    expect(typeof data.data.projection7d.net).toBe("number");
    expect(typeof data.data.projection30d.net).toBe("number");
  });
});

describe.skipIf(!hasDb)("E2E: Settings and team", () => {
  let db: Database;
  beforeAll(async () => {
    db = getTestDb();
    await createTestBusiness(db);
  });

  afterAll(async () => {
    await cleanupTestData(db);
  });

  it("GET /settings returns business settings", async () => {
    const res = await app.request("/api/settings");
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      settings: {
        accountantEmail: string | null;
        whatsappNumber: string | null;
      };
    };
    expect("accountantEmail" in data.settings).toBe(true);
    expect("whatsappNumber" in data.settings).toBe(true);
  });

  it("PATCH /settings updates accountant email", async () => {
    const res = await app.request("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountantEmail: "contador@test.com" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      settings: { accountantEmail: string };
    };
    expect(data.settings.accountantEmail).toBe("contador@test.com");
  });

  it("GET /employees lists team members", async () => {
    const res = await app.request("/api/employees");
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      employees: Array<{ name: string; role: string }>;
    };
    // At least the owner should be listed
    expect(data.employees.length).toBeGreaterThanOrEqual(1);
    expect(data.employees.some((e) => e.role === "owner")).toBe(true);
  });

  it("POST /employees creates a new employee", async () => {
    const res = await app.request("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Carlos Vendedor", pin: "5678" }),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      employee: { name: string; role: string };
    };
    expect(data.employee.name).toBe("Carlos Vendedor");
    expect(data.employee.role).toBe("employee");
  });

  it("GET /exchange-rate returns rate or 503 if not set", async () => {
    const res = await app.request("/api/exchange-rate");
    // Could be 200 (rate exists) or 503 (not configured for this biz)
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      const data = (await res.json()) as { rateBcv: number };
      expect(typeof data.rateBcv).toBe("number");
    }
  });

  it("GET /accounting/accounts returns chart of accounts", async () => {
    const res = await app.request("/api/accounting/accounts");
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      accounts: Array<{ code: string; name: string; type: string }>;
    };
    // Onboarding creates 8 default accounts
    expect(data.accounts.length).toBeGreaterThanOrEqual(8);
    expect(data.accounts.some((a) => a.code === "1101")).toBe(true); // Caja
    expect(data.accounts.some((a) => a.code === "4101")).toBe(true); // Ventas
  });

  it("GET /day-close/history returns past closes", async () => {
    const res = await app.request("/api/day-close/history");
    expect(res.status).toBe(200);
    const data = (await res.json()) as { closes: unknown[] };
    expect(Array.isArray(data.closes)).toBe(true);
  });
});
