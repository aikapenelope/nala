/**
 * PDF export routes for reports.
 *
 * GET /reports/daily/export     - Daily summary PDF
 * GET /reports/weekly/export    - Weekly summary PDF
 * GET /reports/financial/export - Financial P&L PDF
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { sales, saleItems, salePayments, products, expenses } from "@nova/db";
import {
  generateDailyPdf,
  generateWeeklyPdf,
  generateFinancialPdf,
} from "../services/pdf-generator";
import { periodQuery, parsePeriodRange } from "./reports-helpers";
import type { AppEnv } from "../types";

export const reportsPdf = new Hono<AppEnv>();

/** GET /reports/daily/export - Export daily report as PDF. */
reportsPdf.get(
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
    const avgTicket = totalCount > 0 ? Math.round((totalSales / totalCount) * 100) / 100 : 0;
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
      .limit(5);

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

    const pdfBuffer = await generateDailyPdf(
      {
        totalSales,
        totalCount,
        avgTicket,
        vsPreviousDay: yesterdaySales > 0 ? Math.round(((totalSales - yesterdaySales) / yesterdaySales) * 100) : 0,
        vsSameDayLastWeek: lastWeekSales > 0 ? Math.round(((totalSales - lastWeekSales) / lastWeekSales) * 100) : 0,
        topProducts,
        salesByMethod,
      },
      user.businessName,
    );

    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="reporte-diario-${todayStr}.pdf"`);
    return c.body(pdfBuffer);
  },
);

/** GET /reports/weekly/export - Export weekly report as PDF. */
reportsPdf.get(
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
    const pdfBuffer = await generateWeeklyPdf(
      {
        totalSales,
        totalCount: periodTotals?.totalCount ?? 0,
        vsPrevPeriod: prevSales > 0 ? Math.round(((totalSales - prevSales) / prevSales) * 100) : 0,
        dailyBreakdown,
        bestDay: bestDay?.day ?? null,
        topProduct: topProduct?.name ?? null,
      },
      user.businessName,
      query.period,
    );

    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="reporte-semanal-${dateStr}.pdf"`);
    return c.body(pdfBuffer);
  },
);

/** GET /reports/financial/export - Export financial P&L as PDF. */
reportsPdf.get(
  "/reports/financial/export",
  zValidator("query", periodQuery),
  async (c) => {
    const query = c.req.valid("query");
    const db = c.get("db");
    const businessId = c.get("businessId");
    const user = c.get("user");
    const { start, end } = parsePeriodRange(query.period, query.from, query.to);

    const [revResult] = await db
      .select({ revenue: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float` })
      .from(sales)
      .where(and(eq(sales.businessId, businessId), eq(sales.status, "completed"), gte(sales.createdAt, start), lte(sales.createdAt, end)));

    const [cogsResult] = await db
      .select({ cogs: sql<number>`COALESCE(SUM(${products.cost}::numeric * ${saleItems.quantity}), 0)::float` })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(and(eq(sales.businessId, businessId), eq(sales.status, "completed"), gte(sales.createdAt, start), lte(sales.createdAt, end)));

    const [expResult] = await db
      .select({ expenses: sql<number>`COALESCE(SUM(${expenses.total}::numeric), 0)::float` })
      .from(expenses)
      .where(and(eq(expenses.businessId, businessId), eq(expenses.status, "confirmed"), gte(expenses.date, start), lte(expenses.date, end)));

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
        grossMargin: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0,
        netMargin: revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0,
      },
      user.businessName,
      query.period,
    );

    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="estado-resultados-${dateStr}.pdf"`);
    return c.body(pdfBuffer);
  },
);
