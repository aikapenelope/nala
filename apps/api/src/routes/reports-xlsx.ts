/**
 * Excel export routes for reports.
 *
 * GET /reports/daily/export-xlsx     - Daily summary XLSX
 * GET /reports/weekly/export-xlsx    - Weekly summary XLSX
 * GET /reports/sellers/export-xlsx   - Sellers ranking XLSX
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import {
  sales,
  saleItems,
  salePayments,
  products,
} from "@nova/db";
import { todayRangeVET, APP_TIMEZONE, todayStringVET } from "@nova/shared";
import {
  generateDailyExcel,
  generateWeeklyExcel,
} from "../services/excel-generator";
import { periodQuery, parsePeriodRange } from "./reports-helpers";
import type { AppEnv } from "../types";

export const reportsXlsx = new Hono<AppEnv>();

/** GET /reports/daily/export-xlsx */
reportsXlsx.get("/reports/daily/export-xlsx", zValidator("query", periodQuery), async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");
  // Day boundaries in VET (America/Caracas).
  const today = todayRangeVET();
  const todayStr = today.dateStr;
  const todayStart = today.start;
  const todayEnd = today.end;
  const completedCond = eq(sales.status, "completed");
  const bizCond = eq(sales.businessId, businessId);

  const [todayTotals] = await db.select({ totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`, totalCount: sql<number>`count(*)::int` }).from(sales).where(and(bizCond, completedCond, gte(sales.createdAt, todayStart), lte(sales.createdAt, todayEnd)));
  const yesterdayMs = todayStart.getTime() - 24 * 60 * 60 * 1000;
  const yesterdayStart = new Date(yesterdayMs); const yesterdayEnd = new Date(yesterdayMs + 24 * 60 * 60 * 1000 - 1);
  const [yesterdayTotals] = await db.select({ totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float` }).from(sales).where(and(bizCond, completedCond, gte(sales.createdAt, yesterdayStart), lte(sales.createdAt, yesterdayEnd)));
  const lastWeekMs = todayStart.getTime() - 7 * 24 * 60 * 60 * 1000;
  const lastWeekStart = new Date(lastWeekMs); const lastWeekEnd = new Date(lastWeekMs + 24 * 60 * 60 * 1000 - 1);
  const [lastWeekTotals] = await db.select({ totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float` }).from(sales).where(and(bizCond, completedCond, gte(sales.createdAt, lastWeekStart), lte(sales.createdAt, lastWeekEnd)));

  const totalSales = todayTotals?.totalSales ?? 0;
  const totalCount = todayTotals?.totalCount ?? 0;
  const yesterdaySales = yesterdayTotals?.totalSales ?? 0;
  const lastWeekSales = lastWeekTotals?.totalSales ?? 0;

  const topProducts = await db.select({ name: products.name, qty: sql<number>`SUM(${saleItems.quantity})::int`, total: sql<number>`SUM(${saleItems.lineTotal}::numeric)::float` }).from(saleItems).innerJoin(sales, eq(saleItems.saleId, sales.id)).innerJoin(products, eq(saleItems.productId, products.id)).where(and(bizCond, completedCond, gte(sales.createdAt, todayStart), lte(sales.createdAt, todayEnd))).groupBy(products.name).orderBy(desc(sql`SUM(${saleItems.lineTotal}::numeric)`)).limit(10);
  const methodBreakdown = await db.select({ method: salePayments.method, total: sql<number>`SUM(${salePayments.amountUsd}::numeric)::float` }).from(salePayments).innerJoin(sales, eq(salePayments.saleId, sales.id)).where(and(bizCond, completedCond, gte(sales.createdAt, todayStart), lte(sales.createdAt, todayEnd))).groupBy(salePayments.method);
  const salesByMethod: Record<string, number> = {};
  for (const row of methodBreakdown) salesByMethod[row.method] = row.total;

  const buffer = generateDailyExcel({ totalSales, totalCount, avgTicket: totalCount > 0 ? Math.round((totalSales / totalCount) * 100) / 100 : 0, vsPreviousDay: yesterdaySales > 0 ? Math.round(((totalSales - yesterdaySales) / yesterdaySales) * 100) : 0, vsSameDayLastWeek: lastWeekSales > 0 ? Math.round(((totalSales - lastWeekSales) / lastWeekSales) * 100) : 0, topProducts, salesByMethod });
  c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  c.header("Content-Disposition", `attachment; filename="reporte-diario-${todayStr}.xlsx"`);
  return c.body(buffer);
});

/** GET /reports/weekly/export-xlsx */
reportsXlsx.get("/reports/weekly/export-xlsx", zValidator("query", periodQuery), async (c) => {
  const query = c.req.valid("query");
  const db = c.get("db");
  const businessId = c.get("businessId");
  const { start, end } = parsePeriodRange(query.period, query.from, query.to);
  const completedCond = eq(sales.status, "completed");
  const bizCond = eq(sales.businessId, businessId);

  const [periodTotals] = await db.select({ totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`, totalCount: sql<number>`count(*)::int` }).from(sales).where(and(bizCond, completedCond, gte(sales.createdAt, start), lte(sales.createdAt, end)));
  const dailyBreakdown = await db.select({ day: sql<string>`TO_CHAR(${sales.createdAt} AT TIME ZONE ${APP_TIMEZONE}, 'Dy')`, amount: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float` }).from(sales).where(and(bizCond, completedCond, gte(sales.createdAt, start), lte(sales.createdAt, end))).groupBy(sql`TO_CHAR(${sales.createdAt} AT TIME ZONE ${APP_TIMEZONE}, 'Dy')`, sql`DATE(${sales.createdAt} AT TIME ZONE ${APP_TIMEZONE})`).orderBy(sql`DATE(${sales.createdAt} AT TIME ZONE ${APP_TIMEZONE})`);
  const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const prevStart = new Date(start.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const prevEnd = new Date(start.getTime() - 1);
  const [prevTotals] = await db.select({ totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float` }).from(sales).where(and(bizCond, completedCond, gte(sales.createdAt, prevStart), lte(sales.createdAt, prevEnd)));
  const totalSales = periodTotals?.totalSales ?? 0;
  const prevSales = prevTotals?.totalSales ?? 0;
  const bestDay = dailyBreakdown.reduce((best, d) => (d.amount > (best?.amount ?? 0) ? d : best), dailyBreakdown[0]);
  const [topProduct] = await db.select({ name: products.name }).from(saleItems).innerJoin(sales, eq(saleItems.saleId, sales.id)).innerJoin(products, eq(saleItems.productId, products.id)).where(and(bizCond, completedCond, gte(sales.createdAt, start), lte(sales.createdAt, end))).groupBy(products.name).orderBy(desc(sql`SUM(${saleItems.lineTotal}::numeric)`)).limit(1);

  const dateStr = todayStringVET();
  const buffer = generateWeeklyExcel({ totalSales, totalCount: periodTotals?.totalCount ?? 0, vsPrevPeriod: prevSales > 0 ? Math.round(((totalSales - prevSales) / prevSales) * 100) : 0, dailyBreakdown, bestDay: bestDay?.day ?? null, topProduct: topProduct?.name ?? null }, query.period);
  c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  c.header("Content-Disposition", `attachment; filename="reporte-semanal-${dateStr}.xlsx"`);
  return c.body(buffer);
});


