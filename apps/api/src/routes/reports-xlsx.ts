/**
 * Excel export routes for reports.
 *
 * GET /reports/daily/export-xlsx     - Daily summary XLSX
 * GET /reports/weekly/export-xlsx    - Weekly summary XLSX
 * GET /reports/sellers/export-xlsx   - Sellers ranking XLSX
 * GET /reports/libro-ventas/export-xlsx - Libro de ventas SENIAT
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
  users,
} from "@nova/db";
import {
  generateDailyExcel,
  generateWeeklyExcel,
  generateSellersExcel,
  generateLibroVentas,
} from "../services/excel-generator";
import { periodQuery, parsePeriodRange } from "./reports-helpers";
import type { AppEnv } from "../types";

export const reportsXlsx = new Hono<AppEnv>();

/** GET /reports/daily/export-xlsx */
reportsXlsx.get("/reports/daily/export-xlsx", zValidator("query", periodQuery), async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");
  const todayStr = new Date().toISOString().split("T")[0];
  const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
  const todayEnd = new Date(`${todayStr}T23:59:59.999Z`);
  const completedCond = eq(sales.status, "completed");
  const bizCond = eq(sales.businessId, businessId);

  const [todayTotals] = await db.select({ totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`, totalCount: sql<number>`count(*)::int` }).from(sales).where(and(bizCond, completedCond, gte(sales.createdAt, todayStart), lte(sales.createdAt, todayEnd)));
  const yesterday = new Date(todayStart); yesterday.setUTCDate(yesterday.getUTCDate() - 1); const yesterdayStr = yesterday.toISOString().split("T")[0];
  const [yesterdayTotals] = await db.select({ totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float` }).from(sales).where(and(bizCond, completedCond, gte(sales.createdAt, new Date(`${yesterdayStr}T00:00:00.000Z`)), lte(sales.createdAt, new Date(`${yesterdayStr}T23:59:59.999Z`))));
  const lastWeek = new Date(todayStart); lastWeek.setUTCDate(lastWeek.getUTCDate() - 7); const lastWeekStr = lastWeek.toISOString().split("T")[0];
  const [lastWeekTotals] = await db.select({ totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float` }).from(sales).where(and(bizCond, completedCond, gte(sales.createdAt, new Date(`${lastWeekStr}T00:00:00.000Z`)), lte(sales.createdAt, new Date(`${lastWeekStr}T23:59:59.999Z`))));

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
  const dailyBreakdown = await db.select({ day: sql<string>`TO_CHAR(${sales.createdAt} AT TIME ZONE 'UTC', 'Dy')`, amount: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float` }).from(sales).where(and(bizCond, completedCond, gte(sales.createdAt, start), lte(sales.createdAt, end))).groupBy(sql`TO_CHAR(${sales.createdAt} AT TIME ZONE 'UTC', 'Dy')`, sql`DATE(${sales.createdAt})`).orderBy(sql`DATE(${sales.createdAt})`);
  const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const prevStart = new Date(start.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const prevEnd = new Date(start.getTime() - 1);
  const [prevTotals] = await db.select({ totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float` }).from(sales).where(and(bizCond, completedCond, gte(sales.createdAt, prevStart), lte(sales.createdAt, prevEnd)));
  const totalSales = periodTotals?.totalSales ?? 0;
  const prevSales = prevTotals?.totalSales ?? 0;
  const bestDay = dailyBreakdown.reduce((best, d) => (d.amount > (best?.amount ?? 0) ? d : best), dailyBreakdown[0]);
  const [topProduct] = await db.select({ name: products.name }).from(saleItems).innerJoin(sales, eq(saleItems.saleId, sales.id)).innerJoin(products, eq(saleItems.productId, products.id)).where(and(bizCond, completedCond, gte(sales.createdAt, start), lte(sales.createdAt, end))).groupBy(products.name).orderBy(desc(sql`SUM(${saleItems.lineTotal}::numeric)`)).limit(1);

  const dateStr = new Date().toISOString().split("T")[0];
  const buffer = generateWeeklyExcel({ totalSales, totalCount: periodTotals?.totalCount ?? 0, vsPrevPeriod: prevSales > 0 ? Math.round(((totalSales - prevSales) / prevSales) * 100) : 0, dailyBreakdown, bestDay: bestDay?.day ?? null, topProduct: topProduct?.name ?? null }, query.period);
  c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  c.header("Content-Disposition", `attachment; filename="reporte-semanal-${dateStr}.xlsx"`);
  return c.body(buffer);
});

/** GET /reports/sellers/export-xlsx */
reportsXlsx.get("/reports/sellers/export-xlsx", zValidator("query", periodQuery), async (c) => {
  const query = c.req.valid("query");
  const db = c.get("db");
  const businessId = c.get("businessId");
  const { start, end } = parsePeriodRange(query.period, query.from, query.to);

  const sellerStats = await db.select({ name: users.name, salesCount: sql<number>`count(*)::int`, total: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float` }).from(sales).innerJoin(users, eq(sales.userId, users.id)).where(and(eq(sales.businessId, businessId), eq(sales.status, "completed"), gte(sales.createdAt, start), lte(sales.createdAt, end))).groupBy(users.id, users.name).orderBy(desc(sql`SUM(${sales.totalUsd}::numeric)`));

  const dateStr = new Date().toISOString().split("T")[0];
  const buffer = generateSellersExcel({ sellers: sellerStats.map((s) => ({ name: s.name, sales: s.salesCount, total: Math.round(s.total * 100) / 100, avgTicket: s.salesCount > 0 ? Math.round((s.total / s.salesCount) * 100) / 100 : 0 })) });
  c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  c.header("Content-Disposition", `attachment; filename="vendedores-${dateStr}.xlsx"`);
  return c.body(buffer);
});

/** GET /reports/libro-ventas/export-xlsx */
reportsXlsx.get("/reports/libro-ventas/export-xlsx", zValidator("query", periodQuery), async (c) => {
  const query = c.req.valid("query");
  const db = c.get("db");
  const businessId = c.get("businessId");
  const { start, end } = parsePeriodRange(query.period, query.from, query.to);

  const saleRows = await db.select({ id: sales.id, createdAt: sales.createdAt, totalUsd: sales.totalUsd, totalBs: sales.totalBs, exchangeRate: sales.exchangeRate, customerId: sales.customerId }).from(sales).where(and(eq(sales.businessId, businessId), eq(sales.status, "completed"), gte(sales.createdAt, start), lte(sales.createdAt, end))).orderBy(sales.createdAt);

  const customerIds = saleRows.map((s) => s.customerId).filter((id): id is string => id !== null);
  const customerMap = new Map<string, string>();
  if (customerIds.length > 0) {
    const customerRows = await db.select({ id: customers.id, name: customers.name }).from(customers).where(sql`${customers.id} IN (${sql.join(customerIds.map((id) => sql`${id}`), sql`, `)})`);
    for (const cr of customerRows) customerMap.set(cr.id, cr.name);
  }

  const saleIds = saleRows.map((s) => s.id);
  const paymentMap = new Map<string, string>();
  if (saleIds.length > 0) {
    const paymentRows = await db.select({ saleId: salePayments.saleId, method: salePayments.method, amount: sql<number>`${salePayments.amountUsd}::float` }).from(salePayments).where(sql`${salePayments.saleId} IN (${sql.join(saleIds.map((id) => sql`${id}`), sql`, `)})`);
    const bySale = new Map<string, { method: string; amount: number }>();
    for (const p of paymentRows) { const current = bySale.get(p.saleId); if (!current || p.amount > current.amount) bySale.set(p.saleId, { method: p.method, amount: p.amount }); }
    for (const [saleId, { method }] of bySale) paymentMap.set(saleId, method);
  }

  const periodLabel = query.period === "month" ? "Este mes" : query.period === "last_month" ? "Mes anterior" : query.period;
  const dateStr = new Date().toISOString().split("T")[0];
  const buffer = generateLibroVentas(saleRows.map((s, idx) => ({ date: s.createdAt.toISOString().split("T")[0], invoiceNumber: String(idx + 1).padStart(6, "0"), customerName: s.customerId ? (customerMap.get(s.customerId) ?? "Cliente") : "Venta directa", totalUsd: Number(s.totalUsd), totalBs: Number(s.totalBs ?? 0), exchangeRate: Number(s.exchangeRate ?? 0), paymentMethod: paymentMap.get(s.id) ?? "efectivo" })), periodLabel);
  c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  c.header("Content-Disposition", `attachment; filename="libro-ventas-${dateStr}.xlsx"`);
  return c.body(buffer);
});
