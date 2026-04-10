/**
 * Reports API routes.
 *
 * GET /reports/daily          - Today's summary
 * GET /reports/weekly         - Weekly/monthly summary
 * GET /reports/profitability  - Product profitability
 * GET /reports/inventory      - Inventory movement
 * GET /reports/receivable     - Accounts receivable aging
 * GET /reports/sellers        - Sales by seller
 * GET /reports/financial      - P&L simplified
 *
 * Each report returns: data + AI narrative + period info.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateNarrative } from "../services/ai-narrative";
import type { AppEnv } from "../types";

const reports = new Hono<AppEnv>();

/** Common period query param. */
const periodQuery = z.object({
  period: z
    .enum(["today", "week", "month", "last_month", "custom"])
    .default("today"),
  from: z.string().optional(),
  to: z.string().optional(),
});

/** GET /reports/daily - Today's summary with comparisons. */
reports.get("/reports/daily", zValidator("query", periodQuery), async (c) => {
  // TODO: Query today's sales, compare with yesterday and same day last week
  const data = {
    totalSales: 420.0,
    totalCount: 23,
    avgTicket: 18.26,
    vsPreviousDay: 12,
    vsSameDayLastWeek: 8,
    topProducts: [
      { name: "Pan Campesino", qty: 85, total: 127.5 },
      { name: "Café con Leche", qty: 42, total: 42.0 },
    ],
    salesByMethod: { efectivo: 285, pago_movil: 85, binance: 30, fiado: 20 },
  };

  const narrative = await generateNarrative({
    type: "daily_summary",
    data,
  });

  return c.json({ data, narrative, period: "today" });
});

/** GET /reports/weekly - Weekly/monthly trends. */
reports.get("/reports/weekly", zValidator("query", periodQuery), async (c) => {
  const data = {
    totalSales: 3270.0,
    totalCount: 156,
    vsLastWeek: 8,
    dailyBreakdown: [
      { day: "Lu", amount: 420 },
      { day: "Ma", amount: 350 },
      { day: "Mi", amount: 520 },
      { day: "Ju", amount: 300 },
      { day: "Vi", amount: 620 },
      { day: "Sa", amount: 780 },
      { day: "Do", amount: 280 },
    ],
    bestDay: "Sa",
    topProduct: "Pan Campesino",
  };

  const narrative = await generateNarrative({
    type: "weekly_summary",
    data,
  });

  return c.json({ data, narrative, period: c.req.valid("query").period });
});

/** GET /reports/profitability - Product profitability analysis. */
reports.get("/reports/profitability", async (c) => {
  const data = {
    products: [
      { name: "Pan Campesino", margin: 47, rotation: 85, contribution: 30, score: 92 },
      { name: "Café con Leche", margin: 60, rotation: 42, contribution: 10, score: 78 },
      { name: "Queso Blanco", margin: 33, rotation: 15, contribution: 11, score: 55 },
    ],
  };

  const narrative = await generateNarrative({
    type: "product_profitability",
    data,
  });

  return c.json({ data, narrative });
});

/** GET /reports/inventory - Inventory movement. */
reports.get("/reports/inventory", async (c) => {
  const data = {
    totalProducts: 150,
    totalValue: 4500.0,
    movements: { entries: 45, exits: 320, adjustments: 3 },
    lowStock: 3,
    deadStock: 5,
  };

  const narrative = await generateNarrative({
    type: "inventory_movement",
    data,
  });

  return c.json({ data, narrative });
});

/** GET /reports/receivable - Accounts receivable aging. */
reports.get("/reports/receivable", async (c) => {
  const data = {
    total: 285.0,
    aging: { green: 100, yellow: 120, red: 65 },
    topDebtors: [
      { name: "Pedro López", amount: 100, days: 45 },
      { name: "Juan Pérez", amount: 65, days: 35 },
    ],
  };

  const narrative = await generateNarrative({
    type: "receivable_aging",
    data,
  });

  return c.json({ data, narrative });
});

/** GET /reports/sellers - Sales by seller ranking. */
reports.get("/reports/sellers", async (c) => {
  const data = {
    sellers: [
      { name: "María García", sales: 180, total: 2100, avgTicket: 11.67 },
      { name: "Pedro Rodríguez", sales: 120, total: 1800, avgTicket: 15.0 },
    ],
  };

  const narrative = await generateNarrative({
    type: "sales_by_seller",
    data,
  });

  return c.json({ data, narrative });
});

/** GET /reports/financial - Simplified P&L. */
reports.get(
  "/reports/financial",
  zValidator("query", periodQuery),
  async (c) => {
    const data = {
      revenue: 3270.0,
      costOfGoods: 1960.0,
      grossProfit: 1310.0,
      expenses: 450.0,
      netProfit: 860.0,
      grossMargin: 40.1,
      netMargin: 26.3,
    };

    const narrative = await generateNarrative({
      type: "financial_summary",
      data,
    });

    return c.json({ data, narrative, period: c.req.valid("query").period });
  },
);

export { reports };
