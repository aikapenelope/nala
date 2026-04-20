/**
 * Reports API routes.
 *
 * Data endpoints (this file):
 *   GET /reports/daily, weekly, profitability, inventory, receivable, sellers, financial, alerts
 *
 * Export endpoints (separate modules for maintainability):
 *   reports-pdf.ts   - PDF export (daily, weekly, financial)
 *   reports-xlsx.ts  - Excel export (daily, weekly, sellers, libro de ventas)
 *   reports-email.ts - Email with PDF attachment via Resend
 *
 * Shared helpers in reports-helpers.ts (parsePeriodRange, periodQuery).
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import {
  sales,
  saleItems,
  salePayments,
  products,
  customers,
  accountsReceivable,
  accountsPayable,
  expenses,
  users,
} from "@nova/db";
import {
  DEAD_STOCK_DAYS,
  AGING_THRESHOLDS,
} from "@nova/shared";
import { generateNarrative } from "../services/ai-narrative";
import { periodQuery, parsePeriodRange } from "./reports-helpers";
import { reportsPdf } from "./reports-pdf";
import { reportsXlsx } from "./reports-xlsx";
import { reportsEmail } from "./reports-email";
import { validateUuidParam } from "../middleware/validate-uuid";
import type { AppEnv } from "../types";

const reports = new Hono<AppEnv>();

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

  // Today's profit (revenue - cost)
  const [profitResult] = await db
    .select({
      totalCost: sql<number>`COALESCE(SUM(${sales.totalCostUsd}::numeric), 0)::float`,
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
  const totalProfit =
    Math.round((totalSales - (profitResult?.totalCost ?? 0)) * 100) / 100;

  // Top seller today (employee with highest sales)
  const topSellerRows = await db
    .select({
      name: users.name,
      total: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
    })
    .from(sales)
    .innerJoin(users, eq(sales.userId, users.id))
    .where(
      and(
        bizCond,
        completedCond,
        gte(sales.createdAt, todayStart),
        lte(sales.createdAt, todayEnd),
      ),
    )
    .groupBy(users.name)
    .orderBy(sql`SUM(${sales.totalUsd}::numeric) DESC`)
    .limit(1);

  const topSeller = topSellerRows[0]
    ? {
        name: topSellerRows[0].name,
        total: Math.round(topSellerRows[0].total * 100) / 100,
      }
    : null;

  const data = {
    totalSales,
    totalCount,
    avgTicket,
    totalProfit,
    topSeller,
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

  // Least-sold products: never sold or longest time since last sale
  const leastSold = await db
    .select({
      id: products.id,
      name: products.name,
      stock: products.stock,
      price: products.price,
      lastSoldAt: products.lastSoldAt,
    })
    .from(products)
    .where(
      and(
        eq(products.businessId, businessId),
        eq(products.isActive, true),
        sql`${products.stock} > 0`,
        eq(products.isService, false),
      ),
    )
    .orderBy(sql`${products.lastSoldAt} ASC NULLS FIRST`)
    .limit(10);

  const leastSoldProducts = leastSold.map((p) => ({
    id: p.id,
    name: p.name,
    stock: p.stock,
    price: Number(p.price),
    daysSinceLastSale: p.lastSoldAt
      ? Math.floor(
          (Date.now() - p.lastSoldAt.getTime()) / (1000 * 60 * 60 * 24),
        )
      : null,
  }));

  const data = {
    totalProducts: totals?.totalProducts ?? 0,
    totalValue: totals?.totalValue ?? 0,
    lowStock: totals?.lowStock ?? 0,
    criticalStock: totals?.criticalStock ?? 0,
    deadStock: totals?.deadStock ?? 0,
    leastSoldProducts,
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

    // Expenses: sum of confirmed expenses in the period, broken down by category
    const expensesByCategory = await db
      .select({
        category: expenses.category,
        total: sql<number>`COALESCE(SUM(${expenses.total}::numeric), 0)::float`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.businessId, businessId),
          eq(expenses.status, "confirmed"),
          gte(expenses.date, start),
          lte(expenses.date, end),
        ),
      )
      .groupBy(expenses.category);

    const fixedExpenses = expensesByCategory.find((e) => e.category === "fixed")?.total ?? 0;
    const variableExpenses = expensesByCategory.find((e) => e.category === "variable")?.total ?? 0;
    const cogsExpenses = expensesByCategory.find((e) => e.category === "cogs")?.total ?? 0;
    const totalExpenses = fixedExpenses + variableExpenses + cogsExpenses;

    const revenue = revResult?.revenue ?? 0;
    const costOfGoods = cogsResult?.cogs ?? 0;
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
      fixedExpenses: Math.round(fixedExpenses * 100) / 100,
      variableExpenses: Math.round(variableExpenses * 100) / 100,
      cogsExpenses: Math.round(cogsExpenses * 100) / 100,
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
// Cash Flow Projection
// ============================================================

/**
 * GET /reports/cash-flow - Projected cash flow for 7 and 30 days.
 *
 * Calculates projections based on:
 * - Average daily revenue from the last 30 days of completed sales
 * - Average daily expenses from the last 30 days
 * - Pending accounts receivable (money owed to us)
 * - Pending accounts payable (money we owe)
 * - Daily breakdown of last 14 days for trend visualization
 */
reports.get("/reports/cash-flow", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);

  const bizCond = eq(sales.businessId, businessId);
  const completedCond = eq(sales.status, "completed");

  // Average daily revenue (last 30 days)
  const [revResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
    })
    .from(sales)
    .where(
      and(bizCond, completedCond, gte(sales.createdAt, thirtyDaysAgo)),
    );

  const totalRevenue30d = revResult?.total ?? 0;
  const avgDailyRevenue = totalRevenue30d / 30;

  // Average daily expenses (last 30 days)
  const [expResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${expenses.total}::numeric), 0)::float`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.businessId, businessId),
        eq(expenses.status, "confirmed"),
        gte(expenses.date, thirtyDaysAgo),
      ),
    );

  const totalExpenses30d = expResult?.total ?? 0;
  const avgDailyExpenses = totalExpenses30d / 30;

  // Pending accounts receivable
  const [arResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${accountsReceivable.balanceUsd}::numeric), 0)::float`,
    })
    .from(accountsReceivable)
    .where(
      and(
        eq(accountsReceivable.businessId, businessId),
        eq(accountsReceivable.status, "pending"),
      ),
    );

  const pendingReceivable = arResult?.total ?? 0;

  // Pending accounts payable
  const [apResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${accountsPayable.balanceUsd}::numeric), 0)::float`,
    })
    .from(accountsPayable)
    .where(
      and(
        eq(accountsPayable.businessId, businessId),
        eq(accountsPayable.status, "pending"),
      ),
    );

  const pendingPayable = apResult?.total ?? 0;

  // Daily revenue breakdown (last 14 days for trend chart)
  const dailyRevenue = await db
    .select({
      date: sql<string>`DATE(${sales.createdAt})::text`,
      revenue: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
    })
    .from(sales)
    .where(
      and(bizCond, completedCond, gte(sales.createdAt, fourteenDaysAgo)),
    )
    .groupBy(sql`DATE(${sales.createdAt})`)
    .orderBy(sql`DATE(${sales.createdAt})`);

  // Daily expenses breakdown (last 14 days)
  const dailyExpenses = await db
    .select({
      date: sql<string>`DATE(${expenses.date})::text`,
      amount: sql<number>`COALESCE(SUM(${expenses.total}::numeric), 0)::float`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.businessId, businessId),
        eq(expenses.status, "confirmed"),
        gte(expenses.date, fourteenDaysAgo),
      ),
    )
    .groupBy(sql`DATE(${expenses.date})`)
    .orderBy(sql`DATE(${expenses.date})`);

  // Projections
  const projectedRevenue7d = Math.round(avgDailyRevenue * 7 * 100) / 100;
  const projectedExpenses7d = Math.round(avgDailyExpenses * 7 * 100) / 100;
  const projectedNet7d = Math.round((projectedRevenue7d - projectedExpenses7d) * 100) / 100;

  const projectedRevenue30d = Math.round(avgDailyRevenue * 30 * 100) / 100;
  const projectedExpenses30d = Math.round(avgDailyExpenses * 30 * 100) / 100;
  const projectedNet30d = Math.round((projectedRevenue30d - projectedExpenses30d) * 100) / 100;

  const data = {
    avgDailyRevenue: Math.round(avgDailyRevenue * 100) / 100,
    avgDailyExpenses: Math.round(avgDailyExpenses * 100) / 100,
    pendingReceivable: Math.round(pendingReceivable * 100) / 100,
    pendingPayable: Math.round(pendingPayable * 100) / 100,
    projection7d: {
      revenue: projectedRevenue7d,
      expenses: projectedExpenses7d,
      net: projectedNet7d,
    },
    projection30d: {
      revenue: projectedRevenue30d,
      expenses: projectedExpenses30d,
      net: projectedNet30d,
    },
    trend: {
      dailyRevenue,
      dailyExpenses,
    },
  };

  const narrative = await generateNarrative({ type: "cash_flow_projection", data });

  return c.json({ data, narrative });
});

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

  // 5. Products expiring soon (within 30 days)
  const expiringProducts = await db
    .select({
      id: products.id,
      name: products.name,
      expiresAt: products.expiresAt,
    })
    .from(products)
    .where(
      and(
        eq(products.businessId, businessId),
        eq(products.isActive, true),
        sql`${products.stock} > 0`,
        sql`${products.expiresAt} IS NOT NULL`,
        sql`${products.expiresAt} > NOW()`,
        sql`${products.expiresAt} < NOW() + INTERVAL '30 days'`,
      ),
    )
    .limit(5);

  for (const p of expiringProducts) {
    const daysLeft = Math.ceil(
      (p.expiresAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    alerts.push({
      id: `expiring-${p.id}`,
      icon: "⏰",
      title: `${p.name}: vence en ${daysLeft} dia${daysLeft > 1 ? "s" : ""}`,
      suggestion:
        daysLeft <= 7
          ? "Vence esta semana. Considerar descuento urgente."
          : "Vence pronto. Planificar venta o descuento.",
      actionLabel: "Ver producto",
      actionTo: `/inventory/${p.id}`,
      severity: daysLeft <= 7 ? "critical" : "warning",
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
// Monthly Trend
// ============================================================

/**
 * GET /reports/monthly-trend - Revenue by month for the last 12 months.
 *
 * Returns an array of { month: "2026-04", revenue, expenses, net } objects
 * for charting long-term business evolution.
 */
reports.get("/reports/monthly-trend", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const bizCond = eq(sales.businessId, businessId);
  const completedCond = eq(sales.status, "completed");

  // Revenue by month (last 12 months)
  const revenueByMonth = await db
    .select({
      month: sql<string>`TO_CHAR(${sales.createdAt}, 'YYYY-MM')`,
      revenue: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
    })
    .from(sales)
    .where(
      and(
        bizCond,
        completedCond,
        sql`${sales.createdAt} >= NOW() - INTERVAL '12 months'`,
      ),
    )
    .groupBy(sql`TO_CHAR(${sales.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${sales.createdAt}, 'YYYY-MM')`);

  // Expenses by month (last 12 months)
  const expensesByMonth = await db
    .select({
      month: sql<string>`TO_CHAR(${expenses.date}, 'YYYY-MM')`,
      total: sql<number>`COALESCE(SUM(${expenses.total}::numeric), 0)::float`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.businessId, businessId),
        eq(expenses.status, "confirmed"),
        sql`${expenses.date} >= NOW() - INTERVAL '12 months'`,
      ),
    )
    .groupBy(sql`TO_CHAR(${expenses.date}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${expenses.date}, 'YYYY-MM')`);

  const expenseMap = new Map(expensesByMonth.map((e) => [e.month, e.total]));

  const trend = revenueByMonth.map((r) => {
    const exp = expenseMap.get(r.month) ?? 0;
    return {
      month: r.month,
      revenue: Math.round(r.revenue * 100) / 100,
      expenses: Math.round(exp * 100) / 100,
      net: Math.round((r.revenue - exp) * 100) / 100,
    };
  });

  return c.json({ trend });
});

// ============================================================
// Client Stats
// ============================================================

/**
 * GET /reports/customer-stats/:id - Detailed stats for a single customer.
 *
 * Returns purchase history, top products bought, visit frequency,
 * and spending trend.
 */
reports.get("/reports/customer-stats/:id", validateUuidParam, async (c) => {
  const customerId = c.req.param("id");
  const db = c.get("db");
  const businessId = c.get("businessId");

  // Verify customer exists
  const [customer] = await db
    .select()
    .from(customers)
    .where(
      and(eq(customers.id, customerId), eq(customers.businessId, businessId)),
    )
    .limit(1);

  if (!customer) {
    return c.json({ error: "Customer not found" }, 404);
  }

  // Recent sales for this customer (last 20)
  const recentSales = await db
    .select({
      id: sales.id,
      totalUsd: sales.totalUsd,
      createdAt: sales.createdAt,
      status: sales.status,
    })
    .from(sales)
    .where(
      and(
        eq(sales.businessId, businessId),
        eq(sales.customerId, customerId),
      ),
    )
    .orderBy(desc(sales.createdAt))
    .limit(20);

  // Top products bought by this customer
  const topProducts = await db
    .select({
      name: products.name,
      totalQty: sql<number>`SUM(${saleItems.quantity})::int`,
      totalSpent: sql<number>`SUM(${saleItems.lineTotal}::numeric)::float`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(
      and(
        eq(sales.businessId, businessId),
        eq(sales.customerId, customerId),
        eq(sales.status, "completed"),
      ),
    )
    .groupBy(products.id, products.name)
    .orderBy(desc(sql`SUM(${saleItems.lineTotal}::numeric)`))
    .limit(10);

  // Monthly spending trend (last 6 months)
  const spendingTrend = await db
    .select({
      month: sql<string>`TO_CHAR(${sales.createdAt}, 'YYYY-MM')`,
      total: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(sales)
    .where(
      and(
        eq(sales.businessId, businessId),
        eq(sales.customerId, customerId),
        eq(sales.status, "completed"),
        sql`${sales.createdAt} >= NOW() - INTERVAL '6 months'`,
      ),
    )
    .groupBy(sql`TO_CHAR(${sales.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${sales.createdAt}, 'YYYY-MM')`);

  return c.json({
    customer: {
      id: customer.id,
      name: customer.name,
      totalPurchases: customer.totalPurchases,
      totalSpentUsd: Number(customer.totalSpentUsd),
      averageTicketUsd: Number(customer.averageTicketUsd),
      balanceUsd: Number(customer.balanceUsd),
      lastPurchaseAt: customer.lastPurchaseAt,
    },
    recentSales,
    topProducts,
    spendingTrend,
  });
});

// ============================================================
// Mount export sub-routers
// ============================================================

reports.route("/", reportsPdf);
reports.route("/", reportsXlsx);
reports.route("/", reportsEmail);

export { reports };
