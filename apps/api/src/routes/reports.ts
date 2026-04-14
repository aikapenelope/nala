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
 * All queries are real DB aggregations. No mock data.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import {
  sales,
  saleItems,
  salePayments,
  products,
  customers,
  accountsReceivable,
  expenses,
  users,
} from "@nova/db";
import {
  DEAD_STOCK_DAYS,
  AGING_THRESHOLDS,
} from "@nova/shared";
import { generateNarrative } from "../services/ai-narrative";
import type { AppEnv } from "../types";

const reports = new Hono<AppEnv>();

// ============================================================
// Helpers
// ============================================================

/** Parse period query into UTC date range. */
function parsePeriodRange(period: string, from?: string, to?: string) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  let start: Date;
  let end: Date;

  switch (period) {
    case "today":
      start = new Date(`${todayStr}T00:00:00.000Z`);
      end = new Date(`${todayStr}T23:59:59.999Z`);
      break;
    case "week": {
      const dayOfWeek = now.getUTCDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() - mondayOffset);
      start = new Date(monday.toISOString().split("T")[0] + "T00:00:00.000Z");
      end = new Date(`${todayStr}T23:59:59.999Z`);
      break;
    }
    case "month": {
      const monthStr = todayStr.slice(0, 7); // YYYY-MM
      start = new Date(`${monthStr}-01T00:00:00.000Z`);
      end = new Date(`${todayStr}T23:59:59.999Z`);
      break;
    }
    case "last_month": {
      const lastMonth = new Date(now);
      lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
      const lmStr = lastMonth.toISOString().split("T")[0].slice(0, 7);
      start = new Date(`${lmStr}-01T00:00:00.000Z`);
      // Last day of last month = day 0 of current month
      const lastDay = new Date(now.getUTCFullYear(), now.getUTCMonth(), 0);
      end = new Date(lastDay.toISOString().split("T")[0] + "T23:59:59.999Z");
      break;
    }
    case "custom":
      if (!from || !to) {
        // Default to today if custom without dates
        start = new Date(`${todayStr}T00:00:00.000Z`);
        end = new Date(`${todayStr}T23:59:59.999Z`);
      } else {
        start = new Date(`${from}T00:00:00.000Z`);
        end = new Date(`${to}T23:59:59.999Z`);
      }
      break;
    default:
      start = new Date(`${todayStr}T00:00:00.000Z`);
      end = new Date(`${todayStr}T23:59:59.999Z`);
  }

  return { start, end };
}

/** Common period query param. */
const periodQuery = z.object({
  period: z
    .enum(["today", "week", "month", "last_month", "custom"])
    .default("today"),
  from: z.string().optional(),
  to: z.string().optional(),
});

// ============================================================
// Reports
// ============================================================

/** GET /reports/daily - Today's summary with comparisons. */
reports.get("/reports/daily", zValidator("query", periodQuery), async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const todayStr = new Date().toISOString().split("T")[0];
  const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
  const todayEnd = new Date(`${todayStr}T23:59:59.999Z`);

  // Yesterday
  const yesterday = new Date(todayStart);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const yesterdayStart = new Date(`${yesterdayStr}T00:00:00.000Z`);
  const yesterdayEnd = new Date(`${yesterdayStr}T23:59:59.999Z`);

  // Same day last week
  const lastWeek = new Date(todayStart);
  lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
  const lastWeekStr = lastWeek.toISOString().split("T")[0];
  const lastWeekStart = new Date(`${lastWeekStr}T00:00:00.000Z`);
  const lastWeekEnd = new Date(`${lastWeekStr}T23:59:59.999Z`);

  const completedCond = eq(sales.status, "completed");
  const bizCond = eq(sales.businessId, businessId);

  // Today's totals
  const [todayTotals] = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
      totalCount: sql<number>`count(*)::int`,
    })
    .from(sales)
    .where(
      and(
        bizCond,
        completedCond,
        gte(sales.createdAt, todayStart),
        lte(sales.createdAt, todayEnd),
      ),
    );

  // Yesterday's total
  const [yesterdayTotals] = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
    })
    .from(sales)
    .where(
      and(
        bizCond,
        completedCond,
        gte(sales.createdAt, yesterdayStart),
        lte(sales.createdAt, yesterdayEnd),
      ),
    );

  // Same day last week total
  const [lastWeekTotals] = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
    })
    .from(sales)
    .where(
      and(
        bizCond,
        completedCond,
        gte(sales.createdAt, lastWeekStart),
        lte(sales.createdAt, lastWeekEnd),
      ),
    );

  const totalSales = todayTotals?.totalSales ?? 0;
  const totalCount = todayTotals?.totalCount ?? 0;
  const avgTicket =
    totalCount > 0 ? Math.round((totalSales / totalCount) * 100) / 100 : 0;

  const yesterdaySales = yesterdayTotals?.totalSales ?? 0;
  const lastWeekSales = lastWeekTotals?.totalSales ?? 0;

  const vsPreviousDay =
    yesterdaySales > 0
      ? Math.round(((totalSales - yesterdaySales) / yesterdaySales) * 100)
      : 0;
  const vsSameDayLastWeek =
    lastWeekSales > 0
      ? Math.round(((totalSales - lastWeekSales) / lastWeekSales) * 100)
      : 0;

  // Top products today
  const topProducts = await db
    .select({
      name: products.name,
      qty: sql<number>`SUM(${saleItems.quantity})::int`,
      total: sql<number>`SUM(${saleItems.lineTotal}::numeric)::float`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(
      and(
        bizCond,
        completedCond,
        gte(sales.createdAt, todayStart),
        lte(sales.createdAt, todayEnd),
      ),
    )
    .groupBy(products.name)
    .orderBy(desc(sql`SUM(${saleItems.lineTotal}::numeric)`))
    .limit(5);

  // Sales by payment method today
  const methodBreakdown = await db
    .select({
      method: salePayments.method,
      total: sql<number>`SUM(${salePayments.amountUsd}::numeric)::float`,
    })
    .from(salePayments)
    .innerJoin(sales, eq(salePayments.saleId, sales.id))
    .where(
      and(
        bizCond,
        completedCond,
        gte(sales.createdAt, todayStart),
        lte(sales.createdAt, todayEnd),
      ),
    )
    .groupBy(salePayments.method);

  const salesByMethod: Record<string, number> = {};
  for (const row of methodBreakdown) {
    salesByMethod[row.method] = row.total;
  }

  const data = {
    totalSales,
    totalCount,
    avgTicket,
    vsPreviousDay,
    vsSameDayLastWeek,
    topProducts,
    salesByMethod,
  };

  const narrative = await generateNarrative({ type: "daily_summary", data });

  return c.json({ data, narrative, period: "today" });
});

/** GET /reports/weekly - Weekly/monthly trends. */
reports.get("/reports/weekly", zValidator("query", periodQuery), async (c) => {
  const query = c.req.valid("query");
  const db = c.get("db");
  const businessId = c.get("businessId");
  const { start, end } = parsePeriodRange(query.period, query.from, query.to);

  const completedCond = eq(sales.status, "completed");
  const bizCond = eq(sales.businessId, businessId);

  // Total for the period
  const [periodTotals] = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
      totalCount: sql<number>`count(*)::int`,
    })
    .from(sales)
    .where(
      and(
        bizCond,
        completedCond,
        gte(sales.createdAt, start),
        lte(sales.createdAt, end),
      ),
    );

  // Daily breakdown
  const dailyBreakdown = await db
    .select({
      day: sql<string>`TO_CHAR(${sales.createdAt} AT TIME ZONE 'UTC', 'Dy')`,
      amount: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
    })
    .from(sales)
    .where(
      and(
        bizCond,
        completedCond,
        gte(sales.createdAt, start),
        lte(sales.createdAt, end),
      ),
    )
    .groupBy(
      sql`TO_CHAR(${sales.createdAt} AT TIME ZONE 'UTC', 'Dy')`,
      sql`DATE(${sales.createdAt})`,
    )
    .orderBy(sql`DATE(${sales.createdAt})`);

  // Previous period for comparison
  const periodDays = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  const prevStart = new Date(
    start.getTime() - periodDays * 24 * 60 * 60 * 1000,
  );
  const prevEnd = new Date(start.getTime() - 1);

  const [prevTotals] = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
    })
    .from(sales)
    .where(
      and(
        bizCond,
        completedCond,
        gte(sales.createdAt, prevStart),
        lte(sales.createdAt, prevEnd),
      ),
    );

  const totalSales = periodTotals?.totalSales ?? 0;
  const prevSales = prevTotals?.totalSales ?? 0;
  const vsPrevPeriod =
    prevSales > 0
      ? Math.round(((totalSales - prevSales) / prevSales) * 100)
      : 0;

  // Best day and top product
  const bestDay = dailyBreakdown.reduce(
    (best, d) => (d.amount > (best?.amount ?? 0) ? d : best),
    dailyBreakdown[0],
  );

  const [topProduct] = await db
    .select({
      name: products.name,
      total: sql<number>`SUM(${saleItems.lineTotal}::numeric)::float`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(
      and(
        bizCond,
        completedCond,
        gte(sales.createdAt, start),
        lte(sales.createdAt, end),
      ),
    )
    .groupBy(products.name)
    .orderBy(desc(sql`SUM(${saleItems.lineTotal}::numeric)`))
    .limit(1);

  const data = {
    totalSales,
    totalCount: periodTotals?.totalCount ?? 0,
    vsPrevPeriod,
    dailyBreakdown,
    bestDay: bestDay?.day ?? null,
    topProduct: topProduct?.name ?? null,
  };

  const narrative = await generateNarrative({ type: "weekly_summary", data });

  return c.json({ data, narrative, period: query.period });
});

/** GET /reports/profitability - Product profitability analysis. */
reports.get("/reports/profitability", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  // Last 30 days
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const profitability = await db
    .select({
      name: products.name,
      cost: products.cost,
      price: products.price,
      qtySold: sql<number>`COALESCE(SUM(${saleItems.quantity}), 0)::int`,
      revenue: sql<number>`COALESCE(SUM(${saleItems.lineTotal}::numeric), 0)::float`,
    })
    .from(products)
    .leftJoin(saleItems, eq(products.id, saleItems.productId))
    .leftJoin(
      sales,
      and(
        eq(saleItems.saleId, sales.id),
        eq(sales.status, "completed"),
        gte(sales.createdAt, since),
      ),
    )
    .where(
      and(eq(products.businessId, businessId), eq(products.isActive, true)),
    )
    .groupBy(products.id, products.name, products.cost, products.price)
    .orderBy(desc(sql`COALESCE(SUM(${saleItems.lineTotal}::numeric), 0)`))
    .limit(20);

  const totalRevenue = profitability.reduce((s, p) => s + p.revenue, 0);

  const productData = profitability.map((p) => {
    const cost = Number(p.cost);
    const price = Number(p.price);
    const margin = price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
    const contribution =
      totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 100) : 0;
    // Score: weighted combination of margin and contribution
    const score = Math.round(
      margin * 0.4 + contribution * 0.3 + Math.min(p.qtySold, 100) * 0.3,
    );

    return {
      name: p.name,
      margin,
      rotation: p.qtySold,
      contribution,
      score,
    };
  });

  const data = { products: productData };
  const narrative = await generateNarrative({
    type: "product_profitability",
    data,
  });

  return c.json({ data, narrative });
});

/** GET /reports/inventory - Inventory status. */
reports.get("/reports/inventory", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const [totals] = await db
    .select({
      totalProducts: sql<number>`count(*)::int`,
      totalValue: sql<number>`COALESCE(SUM(${products.stock} * ${products.cost}::numeric), 0)::float`,
      lowStock: sql<number>`SUM(CASE WHEN ${products.stock} <= ${products.stockMin} AND ${products.stock} > ${products.stockCritical} THEN 1 ELSE 0 END)::int`,
      criticalStock: sql<number>`SUM(CASE WHEN ${products.stock} <= ${products.stockCritical} THEN 1 ELSE 0 END)::int`,
      deadStock: sql<number>`SUM(CASE WHEN ${products.lastSoldAt} IS NOT NULL AND ${products.lastSoldAt} < NOW() - INTERVAL '${sql.raw(String(DEAD_STOCK_DAYS))} days' THEN 1 ELSE 0 END)::int`,
    })
    .from(products)
    .where(
      and(eq(products.businessId, businessId), eq(products.isActive, true)),
    );

  const data = {
    totalProducts: totals?.totalProducts ?? 0,
    totalValue: totals?.totalValue ?? 0,
    lowStock: totals?.lowStock ?? 0,
    criticalStock: totals?.criticalStock ?? 0,
    deadStock: totals?.deadStock ?? 0,
  };

  const narrative = await generateNarrative({
    type: "inventory_movement",
    data,
  });

  return c.json({ data, narrative });
});

/** GET /reports/receivable - Accounts receivable aging. */
reports.get("/reports/receivable", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const receivables = await db
    .select({
      customerName: customers.name,
      balanceUsd: accountsReceivable.balanceUsd,
      createdAt: accountsReceivable.createdAt,
    })
    .from(accountsReceivable)
    .innerJoin(customers, eq(accountsReceivable.customerId, customers.id))
    .where(
      and(
        eq(accountsReceivable.businessId, businessId),
        eq(accountsReceivable.status, "pending"),
      ),
    )
    .orderBy(desc(accountsReceivable.createdAt));

  let green = 0;
  let yellow = 0;
  let red = 0;
  const now = Date.now();

  const topDebtors: Array<{ name: string; amount: number; days: number }> = [];

  for (const r of receivables) {
    const days = Math.floor(
      (now - r.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const amount = Number(r.balanceUsd);

    if (days > AGING_THRESHOLDS.yellow) {
      red += amount;
    } else if (days > AGING_THRESHOLDS.green) {
      yellow += amount;
    } else {
      green += amount;
    }

    topDebtors.push({ name: r.customerName, amount, days });
  }

  // Sort by amount descending, take top 10
  topDebtors.sort((a, b) => b.amount - a.amount);

  const data = {
    total: Math.round((green + yellow + red) * 100) / 100,
    aging: {
      green: Math.round(green * 100) / 100,
      yellow: Math.round(yellow * 100) / 100,
      red: Math.round(red * 100) / 100,
    },
    topDebtors: topDebtors.slice(0, 10),
  };

  const narrative = await generateNarrative({ type: "receivable_aging", data });

  return c.json({ data, narrative });
});

/** GET /reports/sellers - Sales by seller ranking. */
reports.get("/reports/sellers", zValidator("query", periodQuery), async (c) => {
  const query = c.req.valid("query");
  const db = c.get("db");
  const businessId = c.get("businessId");
  const { start, end } = parsePeriodRange(query.period, query.from, query.to);

  const sellerStats = await db
    .select({
      name: users.name,
      salesCount: sql<number>`count(*)::int`,
      total: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
    })
    .from(sales)
    .innerJoin(users, eq(sales.userId, users.id))
    .where(
      and(
        eq(sales.businessId, businessId),
        eq(sales.status, "completed"),
        gte(sales.createdAt, start),
        lte(sales.createdAt, end),
      ),
    )
    .groupBy(users.id, users.name)
    .orderBy(desc(sql`SUM(${sales.totalUsd}::numeric)`));

  const sellerData = sellerStats.map((s) => ({
    name: s.name,
    sales: s.salesCount,
    total: Math.round(s.total * 100) / 100,
    avgTicket:
      s.salesCount > 0 ? Math.round((s.total / s.salesCount) * 100) / 100 : 0,
  }));

  const data = { sellers: sellerData };
  const narrative = await generateNarrative({ type: "sales_by_seller", data });

  return c.json({ data, narrative, period: query.period });
});

/** GET /reports/financial - Simplified P&L. */
reports.get(
  "/reports/financial",
  zValidator("query", periodQuery),
  async (c) => {
    const query = c.req.valid("query");
    const db = c.get("db");
    const businessId = c.get("businessId");
    const { start, end } = parsePeriodRange(query.period, query.from, query.to);

    // Revenue: sum of completed sales
    const [revResult] = await db
      .select({
        revenue: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.businessId, businessId),
          eq(sales.status, "completed"),
          gte(sales.createdAt, start),
          lte(sales.createdAt, end),
        ),
      );

    // Cost of goods: sum of (cost * quantity) for items in completed sales
    const [cogsResult] = await db
      .select({
        cogs: sql<number>`COALESCE(SUM(${products.cost}::numeric * ${saleItems.quantity}), 0)::float`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(
        and(
          eq(sales.businessId, businessId),
          eq(sales.status, "completed"),
          gte(sales.createdAt, start),
          lte(sales.createdAt, end),
        ),
      );

    // Expenses: sum of confirmed expenses in the period
    const [expResult] = await db
      .select({
        expenses: sql<number>`COALESCE(SUM(${expenses.total}::numeric), 0)::float`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.businessId, businessId),
          eq(expenses.status, "confirmed"),
          gte(expenses.date, start),
          lte(expenses.date, end),
        ),
      );

    const revenue = revResult?.revenue ?? 0;
    const costOfGoods = cogsResult?.cogs ?? 0;
    const totalExpenses = expResult?.expenses ?? 0;
    const grossProfit = revenue - costOfGoods;
    const netProfit = grossProfit - totalExpenses;
    const grossMargin =
      revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;
    const netMargin =
      revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0;

    const data = {
      revenue: Math.round(revenue * 100) / 100,
      costOfGoods: Math.round(costOfGoods * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      grossMargin,
      netMargin,
    };

    const narrative = await generateNarrative({
      type: "financial_summary",
      data,
    });

    return c.json({ data, narrative, period: query.period });
  },
);

// ============================================================
// Smart Alerts
// ============================================================

/** Alert severity levels. */
type AlertSeverity = "critical" | "warning" | "info";

interface SmartAlert {
  id: string;
  icon: string;
  title: string;
  suggestion: string;
  actionLabel: string;
  actionTo: string;
  severity: AlertSeverity;
}

/**
 * GET /reports/alerts - Smart actionable alerts for the dashboard.
 *
 * Generates alerts from real data:
 * - Critical stock products (red semaphore) with reorder suggestion
 * - Low stock products (yellow semaphore) with days-to-depletion estimate
 * - Overdue receivables (>30 days) with WhatsApp collection link
 * - Dead stock products (no movement in 60+ days)
 */
reports.get("/reports/alerts", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");
  const alerts: SmartAlert[] = [];

  // 1. Critical stock products (stock <= stockCritical)
  const criticalProducts = await db
    .select({
      id: products.id,
      name: products.name,
      stock: products.stock,
      stockCritical: products.stockCritical,
    })
    .from(products)
    .where(
      and(
        eq(products.businessId, businessId),
        eq(products.isActive, true),
        sql`${products.stock} <= ${products.stockCritical}`,
        sql`(${products.lastSoldAt} IS NULL OR ${products.lastSoldAt} >= NOW() - INTERVAL '${sql.raw(String(DEAD_STOCK_DAYS))} days')`,
      ),
    )
    .limit(5);

  for (const p of criticalProducts) {
    alerts.push({
      id: `stock-critical-${p.id}`,
      icon: "🔴",
      title: `${p.name}: solo ${p.stock} en stock`,
      suggestion: "Stock critico. Pedir al proveedor urgente.",
      actionLabel: "Ver producto",
      actionTo: `/inventory/${p.id}`,
      severity: "critical",
    });
  }

  // 2. Low stock products (stock <= stockMin but > stockCritical)
  const lowProducts = await db
    .select({
      id: products.id,
      name: products.name,
      stock: products.stock,
    })
    .from(products)
    .where(
      and(
        eq(products.businessId, businessId),
        eq(products.isActive, true),
        sql`${products.stock} > ${products.stockCritical}`,
        sql`${products.stock} <= ${products.stockMin}`,
        sql`(${products.lastSoldAt} IS NULL OR ${products.lastSoldAt} >= NOW() - INTERVAL '${sql.raw(String(DEAD_STOCK_DAYS))} days')`,
      ),
    )
    .limit(3);

  for (const p of lowProducts) {
    alerts.push({
      id: `stock-low-${p.id}`,
      icon: "📦",
      title: `${p.name}: ${p.stock} unidades restantes`,
      suggestion: "Stock bajo. Considerar reposicion.",
      actionLabel: "Ver inventario",
      actionTo: "/inventory?status=yellow",
      severity: "warning",
    });
  }

  // 3. Overdue receivables (>30 days)
  const overdueReceivables = await db
    .select({
      id: accountsReceivable.id,
      customerId: accountsReceivable.customerId,
      balanceUsd: accountsReceivable.balanceUsd,
      createdAt: accountsReceivable.createdAt,
      customerName: customers.name,
      customerPhone: customers.phone,
    })
    .from(accountsReceivable)
    .innerJoin(customers, eq(accountsReceivable.customerId, customers.id))
    .where(
      and(
        eq(accountsReceivable.businessId, businessId),
        eq(accountsReceivable.status, "pending"),
        sql`${accountsReceivable.createdAt} < NOW() - INTERVAL '${sql.raw(String(AGING_THRESHOLDS.yellow))} days'`,
      ),
    )
    .orderBy(desc(sql`${accountsReceivable.balanceUsd}::numeric`))
    .limit(3);

  for (const r of overdueReceivables) {
    const days = Math.floor(
      (Date.now() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const hasPhone = !!r.customerPhone;

    alerts.push({
      id: `receivable-overdue-${r.id}`,
      icon: "💰",
      title: `${r.customerName} debe $${Number(r.balanceUsd).toFixed(2)} hace ${days} dias`,
      suggestion: hasPhone
        ? "Tiene telefono registrado. Puedes cobrar por WhatsApp."
        : "Sin telefono registrado. Contactar directamente.",
      actionLabel: hasPhone ? "Cobrar por WhatsApp" : "Ver cuentas",
      actionTo: "/accounts",
      severity: days > 45 ? "critical" : "warning",
    });
  }

  // 4. Dead stock (no movement in 60+ days, but has stock)
  const [deadCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(
      and(
        eq(products.businessId, businessId),
        eq(products.isActive, true),
        sql`${products.stock} > 0`,
        sql`${products.lastSoldAt} IS NOT NULL`,
        sql`${products.lastSoldAt} < NOW() - INTERVAL '${sql.raw(String(DEAD_STOCK_DAYS))} days'`,
      ),
    );

  if (deadCount && deadCount.count > 0) {
    alerts.push({
      id: "dead-stock",
      icon: "⚠️",
      title: `${deadCount.count} producto${deadCount.count > 1 ? "s" : ""} sin movimiento en 60+ dias`,
      suggestion: "Considerar descuento o liquidacion para liberar capital.",
      actionLabel: "Ver productos",
      actionTo: "/inventory?status=gray",
      severity: "info",
    });
  }

  // Sort: critical first, then warning, then info
  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return c.json({ alerts });
});

// ============================================================
// PDF Export Endpoints
// ============================================================

import {
  generateDailyPdf,
  generateWeeklyPdf,
  generateFinancialPdf,
} from "../services/pdf-generator";

/** GET /reports/daily/export?format=pdf - Export daily report as PDF. */
reports.get(
  "/reports/daily/export",
  zValidator("query", periodQuery),
  async (c) => {
    const db = c.get("db");
    const businessId = c.get("businessId");
    const user = c.get("user");

    const todayStr = new Date().toISOString().split("T")[0];
    const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
    const todayEnd = new Date(`${todayStr}T23:59:59.999Z`);

    const completedCond = eq(sales.status, "completed");
    const bizCond = eq(sales.businessId, businessId);

    const [todayTotals] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(sales)
      .where(
        and(
          bizCond,
          completedCond,
          gte(sales.createdAt, todayStart),
          lte(sales.createdAt, todayEnd),
        ),
      );

    const yesterday = new Date(todayStart);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const [yesterdayTotals] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
      })
      .from(sales)
      .where(
        and(
          bizCond,
          completedCond,
          gte(sales.createdAt, new Date(`${yesterdayStr}T00:00:00.000Z`)),
          lte(sales.createdAt, new Date(`${yesterdayStr}T23:59:59.999Z`)),
        ),
      );

    const lastWeek = new Date(todayStart);
    lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
    const lastWeekStr = lastWeek.toISOString().split("T")[0];
    const [lastWeekTotals] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
      })
      .from(sales)
      .where(
        and(
          bizCond,
          completedCond,
          gte(sales.createdAt, new Date(`${lastWeekStr}T00:00:00.000Z`)),
          lte(sales.createdAt, new Date(`${lastWeekStr}T23:59:59.999Z`)),
        ),
      );

    const totalSales = todayTotals?.totalSales ?? 0;
    const totalCount = todayTotals?.totalCount ?? 0;
    const avgTicket =
      totalCount > 0 ? Math.round((totalSales / totalCount) * 100) / 100 : 0;
    const yesterdaySales = yesterdayTotals?.totalSales ?? 0;
    const lastWeekSales = lastWeekTotals?.totalSales ?? 0;

    const topProducts = await db
      .select({
        name: products.name,
        qty: sql<number>`SUM(${saleItems.quantity})::int`,
        total: sql<number>`SUM(${saleItems.lineTotal}::numeric)::float`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(
        and(
          bizCond,
          completedCond,
          gte(sales.createdAt, todayStart),
          lte(sales.createdAt, todayEnd),
        ),
      )
      .groupBy(products.name)
      .orderBy(desc(sql`SUM(${saleItems.lineTotal}::numeric)`))
      .limit(5);

    const methodBreakdown = await db
      .select({
        method: salePayments.method,
        total: sql<number>`SUM(${salePayments.amountUsd}::numeric)::float`,
      })
      .from(salePayments)
      .innerJoin(sales, eq(salePayments.saleId, sales.id))
      .where(
        and(
          bizCond,
          completedCond,
          gte(sales.createdAt, todayStart),
          lte(sales.createdAt, todayEnd),
        ),
      )
      .groupBy(salePayments.method);

    const salesByMethod: Record<string, number> = {};
    for (const row of methodBreakdown) {
      salesByMethod[row.method] = row.total;
    }

    const pdfBuffer = await generateDailyPdf(
      {
        totalSales,
        totalCount,
        avgTicket,
        vsPreviousDay:
          yesterdaySales > 0
            ? Math.round(
                ((totalSales - yesterdaySales) / yesterdaySales) * 100,
              )
            : 0,
        vsSameDayLastWeek:
          lastWeekSales > 0
            ? Math.round(
                ((totalSales - lastWeekSales) / lastWeekSales) * 100,
              )
            : 0,
        topProducts,
        salesByMethod,
      },
      user.businessName,
    );

    c.header("Content-Type", "application/pdf");
    c.header(
      "Content-Disposition",
      `attachment; filename="reporte-diario-${todayStr}.pdf"`,
    );
    return c.body(pdfBuffer);
  },
);

/** GET /reports/weekly/export?format=pdf - Export weekly report as PDF. */
reports.get(
  "/reports/weekly/export",
  zValidator("query", periodQuery),
  async (c) => {
    const query = c.req.valid("query");
    const db = c.get("db");
    const businessId = c.get("businessId");
    const user = c.get("user");
    const { start, end } = parsePeriodRange(query.period, query.from, query.to);

    const completedCond = eq(sales.status, "completed");
    const bizCond = eq(sales.businessId, businessId);

    const [periodTotals] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(sales)
      .where(
        and(
          bizCond,
          completedCond,
          gte(sales.createdAt, start),
          lte(sales.createdAt, end),
        ),
      );

    const dailyBreakdown = await db
      .select({
        day: sql<string>`TO_CHAR(${sales.createdAt} AT TIME ZONE 'UTC', 'Dy')`,
        amount: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
      })
      .from(sales)
      .where(
        and(
          bizCond,
          completedCond,
          gte(sales.createdAt, start),
          lte(sales.createdAt, end),
        ),
      )
      .groupBy(
        sql`TO_CHAR(${sales.createdAt} AT TIME ZONE 'UTC', 'Dy')`,
        sql`DATE(${sales.createdAt})`,
      )
      .orderBy(sql`DATE(${sales.createdAt})`);

    const periodDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    const prevStart = new Date(
      start.getTime() - periodDays * 24 * 60 * 60 * 1000,
    );
    const prevEnd = new Date(start.getTime() - 1);

    const [prevTotals] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
      })
      .from(sales)
      .where(
        and(
          bizCond,
          completedCond,
          gte(sales.createdAt, prevStart),
          lte(sales.createdAt, prevEnd),
        ),
      );

    const totalSales = periodTotals?.totalSales ?? 0;
    const prevSales = prevTotals?.totalSales ?? 0;
    const bestDay = dailyBreakdown.reduce(
      (best, d) => (d.amount > (best?.amount ?? 0) ? d : best),
      dailyBreakdown[0],
    );

    const [topProduct] = await db
      .select({
        name: products.name,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(
        and(
          bizCond,
          completedCond,
          gte(sales.createdAt, start),
          lte(sales.createdAt, end),
        ),
      )
      .groupBy(products.name)
      .orderBy(desc(sql`SUM(${saleItems.lineTotal}::numeric)`))
      .limit(1);

    const dateStr = new Date().toISOString().split("T")[0];
    const pdfBuffer = await generateWeeklyPdf(
      {
        totalSales,
        totalCount: periodTotals?.totalCount ?? 0,
        vsPrevPeriod:
          prevSales > 0
            ? Math.round(((totalSales - prevSales) / prevSales) * 100)
            : 0,
        dailyBreakdown,
        bestDay: bestDay?.day ?? null,
        topProduct: topProduct?.name ?? null,
      },
      user.businessName,
      query.period,
    );

    c.header("Content-Type", "application/pdf");
    c.header(
      "Content-Disposition",
      `attachment; filename="reporte-semanal-${dateStr}.pdf"`,
    );
    return c.body(pdfBuffer);
  },
);

/** GET /reports/financial/export?format=pdf - Export financial P&L as PDF. */
reports.get(
  "/reports/financial/export",
  zValidator("query", periodQuery),
  async (c) => {
    const query = c.req.valid("query");
    const db = c.get("db");
    const businessId = c.get("businessId");
    const user = c.get("user");
    const { start, end } = parsePeriodRange(query.period, query.from, query.to);

    const [revResult] = await db
      .select({
        revenue: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.businessId, businessId),
          eq(sales.status, "completed"),
          gte(sales.createdAt, start),
          lte(sales.createdAt, end),
        ),
      );

    const [cogsResult] = await db
      .select({
        cogs: sql<number>`COALESCE(SUM(${products.cost}::numeric * ${saleItems.quantity}), 0)::float`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(
        and(
          eq(sales.businessId, businessId),
          eq(sales.status, "completed"),
          gte(sales.createdAt, start),
          lte(sales.createdAt, end),
        ),
      );

    const [expResult] = await db
      .select({
        expenses: sql<number>`COALESCE(SUM(${expenses.total}::numeric), 0)::float`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.businessId, businessId),
          eq(expenses.status, "confirmed"),
          gte(expenses.date, start),
          lte(expenses.date, end),
        ),
      );

    const revenue = revResult?.revenue ?? 0;
    const costOfGoods = cogsResult?.cogs ?? 0;
    const totalExpenses = expResult?.expenses ?? 0;
    const grossProfit = revenue - costOfGoods;
    const netProfit = grossProfit - totalExpenses;

    const dateStr = new Date().toISOString().split("T")[0];
    const pdfBuffer = await generateFinancialPdf(
      {
        revenue: Math.round(revenue * 100) / 100,
        costOfGoods: Math.round(costOfGoods * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        expenses: Math.round(totalExpenses * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        grossMargin:
          revenue > 0
            ? Math.round((grossProfit / revenue) * 1000) / 10
            : 0,
        netMargin:
          revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0,
      },
      user.businessName,
      query.period,
    );

    c.header("Content-Type", "application/pdf");
    c.header(
      "Content-Disposition",
      `attachment; filename="estado-resultados-${dateStr}.pdf"`,
    );
    return c.body(pdfBuffer);
  },
);

// ============================================================
// Excel Export Endpoints
// ============================================================

import {
  generateDailyExcel,
  generateWeeklyExcel,
  generateSellersExcel,
  generateLibroVentas,
} from "../services/excel-generator";

/** GET /reports/daily/export-xlsx - Export daily report as Excel. */
reports.get(
  "/reports/daily/export-xlsx",
  zValidator("query", periodQuery),
  async (c) => {
    const db = c.get("db");
    const businessId = c.get("businessId");

    const todayStr = new Date().toISOString().split("T")[0];
    const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
    const todayEnd = new Date(`${todayStr}T23:59:59.999Z`);

    const completedCond = eq(sales.status, "completed");
    const bizCond = eq(sales.businessId, businessId);

    const [todayTotals] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(sales)
      .where(and(bizCond, completedCond, gte(sales.createdAt, todayStart), lte(sales.createdAt, todayEnd)));

    const yesterday = new Date(todayStart);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const [yesterdayTotals] = await db
      .select({ totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float` })
      .from(sales)
      .where(and(bizCond, completedCond, gte(sales.createdAt, new Date(`${yesterdayStr}T00:00:00.000Z`)), lte(sales.createdAt, new Date(`${yesterdayStr}T23:59:59.999Z`))));

    const lastWeek = new Date(todayStart);
    lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
    const lastWeekStr = lastWeek.toISOString().split("T")[0];
    const [lastWeekTotals] = await db
      .select({ totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float` })
      .from(sales)
      .where(and(bizCond, completedCond, gte(sales.createdAt, new Date(`${lastWeekStr}T00:00:00.000Z`)), lte(sales.createdAt, new Date(`${lastWeekStr}T23:59:59.999Z`))));

    const totalSales = todayTotals?.totalSales ?? 0;
    const totalCount = todayTotals?.totalCount ?? 0;
    const yesterdaySales = yesterdayTotals?.totalSales ?? 0;
    const lastWeekSales = lastWeekTotals?.totalSales ?? 0;

    const topProducts = await db
      .select({
        name: products.name,
        qty: sql<number>`SUM(${saleItems.quantity})::int`,
        total: sql<number>`SUM(${saleItems.lineTotal}::numeric)::float`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(and(bizCond, completedCond, gte(sales.createdAt, todayStart), lte(sales.createdAt, todayEnd)))
      .groupBy(products.name)
      .orderBy(desc(sql`SUM(${saleItems.lineTotal}::numeric)`))
      .limit(10);

    const methodBreakdown = await db
      .select({
        method: salePayments.method,
        total: sql<number>`SUM(${salePayments.amountUsd}::numeric)::float`,
      })
      .from(salePayments)
      .innerJoin(sales, eq(salePayments.saleId, sales.id))
      .where(and(bizCond, completedCond, gte(sales.createdAt, todayStart), lte(sales.createdAt, todayEnd)))
      .groupBy(salePayments.method);

    const salesByMethod: Record<string, number> = {};
    for (const row of methodBreakdown) salesByMethod[row.method] = row.total;

    const buffer = generateDailyExcel({
      totalSales,
      totalCount,
      avgTicket: totalCount > 0 ? Math.round((totalSales / totalCount) * 100) / 100 : 0,
      vsPreviousDay: yesterdaySales > 0 ? Math.round(((totalSales - yesterdaySales) / yesterdaySales) * 100) : 0,
      vsSameDayLastWeek: lastWeekSales > 0 ? Math.round(((totalSales - lastWeekSales) / lastWeekSales) * 100) : 0,
      topProducts,
      salesByMethod,
    });

    c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    c.header("Content-Disposition", `attachment; filename="reporte-diario-${todayStr}.xlsx"`);
    return c.body(buffer);
  },
);

/** GET /reports/weekly/export-xlsx - Export weekly report as Excel. */
reports.get(
  "/reports/weekly/export-xlsx",
  zValidator("query", periodQuery),
  async (c) => {
    const query = c.req.valid("query");
    const db = c.get("db");
    const businessId = c.get("businessId");
    const { start, end } = parsePeriodRange(query.period, query.from, query.to);

    const completedCond = eq(sales.status, "completed");
    const bizCond = eq(sales.businessId, businessId);

    const [periodTotals] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(sales)
      .where(and(bizCond, completedCond, gte(sales.createdAt, start), lte(sales.createdAt, end)));

    const dailyBreakdown = await db
      .select({
        day: sql<string>`TO_CHAR(${sales.createdAt} AT TIME ZONE 'UTC', 'Dy')`,
        amount: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
      })
      .from(sales)
      .where(and(bizCond, completedCond, gte(sales.createdAt, start), lte(sales.createdAt, end)))
      .groupBy(sql`TO_CHAR(${sales.createdAt} AT TIME ZONE 'UTC', 'Dy')`, sql`DATE(${sales.createdAt})`)
      .orderBy(sql`DATE(${sales.createdAt})`);

    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(start.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const prevEnd = new Date(start.getTime() - 1);

    const [prevTotals] = await db
      .select({ totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float` })
      .from(sales)
      .where(and(bizCond, completedCond, gte(sales.createdAt, prevStart), lte(sales.createdAt, prevEnd)));

    const totalSales = periodTotals?.totalSales ?? 0;
    const prevSales = prevTotals?.totalSales ?? 0;
    const bestDay = dailyBreakdown.reduce((best, d) => (d.amount > (best?.amount ?? 0) ? d : best), dailyBreakdown[0]);

    const [topProduct] = await db
      .select({ name: products.name })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(and(bizCond, completedCond, gte(sales.createdAt, start), lte(sales.createdAt, end)))
      .groupBy(products.name)
      .orderBy(desc(sql`SUM(${saleItems.lineTotal}::numeric)`))
      .limit(1);

    const dateStr = new Date().toISOString().split("T")[0];
    const buffer = generateWeeklyExcel(
      {
        totalSales,
        totalCount: periodTotals?.totalCount ?? 0,
        vsPrevPeriod: prevSales > 0 ? Math.round(((totalSales - prevSales) / prevSales) * 100) : 0,
        dailyBreakdown,
        bestDay: bestDay?.day ?? null,
        topProduct: topProduct?.name ?? null,
      },
      query.period,
    );

    c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    c.header("Content-Disposition", `attachment; filename="reporte-semanal-${dateStr}.xlsx"`);
    return c.body(buffer);
  },
);

/** GET /reports/sellers/export-xlsx - Export sellers ranking as Excel. */
reports.get(
  "/reports/sellers/export-xlsx",
  zValidator("query", periodQuery),
  async (c) => {
    const query = c.req.valid("query");
    const db = c.get("db");
    const businessId = c.get("businessId");
    const { start, end } = parsePeriodRange(query.period, query.from, query.to);

    const sellerStats = await db
      .select({
        name: users.name,
        salesCount: sql<number>`count(*)::int`,
        total: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
      })
      .from(sales)
      .innerJoin(users, eq(sales.userId, users.id))
      .where(and(eq(sales.businessId, businessId), eq(sales.status, "completed"), gte(sales.createdAt, start), lte(sales.createdAt, end)))
      .groupBy(users.id, users.name)
      .orderBy(desc(sql`SUM(${sales.totalUsd}::numeric)`));

    const dateStr = new Date().toISOString().split("T")[0];
    const buffer = generateSellersExcel({
      sellers: sellerStats.map((s) => ({
        name: s.name,
        sales: s.salesCount,
        total: Math.round(s.total * 100) / 100,
        avgTicket: s.salesCount > 0 ? Math.round((s.total / s.salesCount) * 100) / 100 : 0,
      })),
    });

    c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    c.header("Content-Disposition", `attachment; filename="vendedores-${dateStr}.xlsx"`);
    return c.body(buffer);
  },
);

/** GET /reports/libro-ventas/export-xlsx - Libro de ventas formato SENIAT. */
reports.get(
  "/reports/libro-ventas/export-xlsx",
  zValidator("query", periodQuery),
  async (c) => {
    const query = c.req.valid("query");
    const db = c.get("db");
    const businessId = c.get("businessId");
    const { start, end } = parsePeriodRange(query.period, query.from, query.to);

    const saleRows = await db
      .select({
        id: sales.id,
        createdAt: sales.createdAt,
        totalUsd: sales.totalUsd,
        totalBs: sales.totalBs,
        exchangeRate: sales.exchangeRate,
        customerId: sales.customerId,
      })
      .from(sales)
      .where(and(eq(sales.businessId, businessId), eq(sales.status, "completed"), gte(sales.createdAt, start), lte(sales.createdAt, end)))
      .orderBy(sales.createdAt);

    // Get customer names for sales with customers
    const customerIds = saleRows.map((s) => s.customerId).filter((id): id is string => id !== null);
    const customerMap = new Map<string, string>();
    if (customerIds.length > 0) {
      const customerRows = await db
        .select({ id: customers.id, name: customers.name })
        .from(customers)
        .where(sql`${customers.id} IN (${sql.join(customerIds.map((id) => sql`${id}`), sql`, `)})`);
      for (const c of customerRows) customerMap.set(c.id, c.name);
    }

    // Get primary payment method per sale
    const saleIds = saleRows.map((s) => s.id);
    const paymentMap = new Map<string, string>();
    if (saleIds.length > 0) {
      const paymentRows = await db
        .select({
          saleId: salePayments.saleId,
          method: salePayments.method,
          amount: sql<number>`${salePayments.amountUsd}::float`,
        })
        .from(salePayments)
        .where(sql`${salePayments.saleId} IN (${sql.join(saleIds.map((id) => sql`${id}`), sql`, `)})`);

      // Group by sale, pick method with highest amount
      const bySale = new Map<string, { method: string; amount: number }>();
      for (const p of paymentRows) {
        const current = bySale.get(p.saleId);
        if (!current || p.amount > current.amount) {
          bySale.set(p.saleId, { method: p.method, amount: p.amount });
        }
      }
      for (const [saleId, { method }] of bySale) paymentMap.set(saleId, method);
    }

    const periodLabel = query.period === "month" ? "Este mes" : query.period === "last_month" ? "Mes anterior" : query.period;
    const dateStr = new Date().toISOString().split("T")[0];

    const buffer = generateLibroVentas(
      saleRows.map((s, idx) => ({
        date: s.createdAt.toISOString().split("T")[0],
        invoiceNumber: String(idx + 1).padStart(6, "0"),
        customerName: s.customerId ? (customerMap.get(s.customerId) ?? "Cliente") : "Venta directa",
        totalUsd: Number(s.totalUsd),
        totalBs: Number(s.totalBs ?? 0),
        exchangeRate: Number(s.exchangeRate ?? 0),
        paymentMethod: paymentMap.get(s.id) ?? "efectivo",
      })),
      periodLabel,
    );

    c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    c.header("Content-Disposition", `attachment; filename="libro-ventas-${dateStr}.xlsx"`);
    return c.body(buffer);
  },
);

export { reports };
