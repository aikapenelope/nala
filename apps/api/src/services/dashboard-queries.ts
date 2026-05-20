/**
 * Dashboard query functions.
 *
 * Each function encapsulates a single data section for the consolidated
 * dashboard endpoint. They run in parallel via Promise.allSettled so that
 * one failing section doesn't break the entire dashboard.
 *
 * These functions extract the core query logic from the individual report
 * endpoints (reports.ts, orders.ts, sales.ts) without duplicating it —
 * the original endpoints remain unchanged for backward compatibility.
 */

import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import {
  sales,
  saleItems,
  salePayments,
  products,
  customers,
  accountsReceivable,
  expenses,
  orders,
  storeSettings,
} from "@nova/db";
import {
  DEAD_STOCK_DAYS,
  AGING_THRESHOLDS,
  todayRangeVET,
  currentDayOfWeekVET,
  APP_TIMEZONE,
} from "@nova/shared";
import type { Database } from "@nova/db";
import { getCurrentRate } from "./exchange-rate";

// ============================================================
// Daily report
// ============================================================

export async function fetchDailyReport(db: Database, businessId: string) {
  const today = todayRangeVET();
  const todayStart = today.start;
  const todayEnd = today.end;

  const lastWeekMs = todayStart.getTime() - 7 * 24 * 60 * 60 * 1000;
  const lastWeekStart = new Date(lastWeekMs);
  const lastWeekEnd = new Date(lastWeekMs + 24 * 60 * 60 * 1000 - 1);

  const completedCond = eq(sales.status, "completed");
  const bizCond = eq(sales.businessId, businessId);

  const [todayTotals, lastWeekTotals, topProducts, methodBreakdown, profitResult] =
    await Promise.all([
      db
        .select({
          totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
          totalCount: sql<number>`count(*)::int`,
        })
        .from(sales)
        .where(and(bizCond, completedCond, gte(sales.createdAt, todayStart), lte(sales.createdAt, todayEnd))),
      db
        .select({
          totalSales: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
        })
        .from(sales)
        .where(and(bizCond, completedCond, gte(sales.createdAt, lastWeekStart), lte(sales.createdAt, lastWeekEnd))),
      db
        .select({
          name: products.name,
          quantity: sql<number>`SUM(${saleItems.quantity})::int`,
        })
        .from(saleItems)
        .innerJoin(sales, eq(saleItems.saleId, sales.id))
        .innerJoin(products, eq(saleItems.productId, products.id))
        .where(and(bizCond, completedCond, gte(sales.createdAt, todayStart), lte(sales.createdAt, todayEnd)))
        .groupBy(products.name)
        .orderBy(desc(sql`SUM(${saleItems.quantity})`))
        .limit(5),
      db
        .select({
          method: salePayments.method,
          total: sql<number>`SUM(${salePayments.amountUsd}::numeric)::float`,
        })
        .from(salePayments)
        .innerJoin(sales, eq(salePayments.saleId, sales.id))
        .where(and(bizCond, completedCond, gte(sales.createdAt, todayStart), lte(sales.createdAt, todayEnd)))
        .groupBy(salePayments.method),
      db
        .select({
          totalCost: sql<number>`COALESCE(SUM(${sales.totalCostUsd}::numeric), 0)::float`,
        })
        .from(sales)
        .where(and(bizCond, completedCond, gte(sales.createdAt, todayStart), lte(sales.createdAt, todayEnd))),
    ]);

  const totalSales = todayTotals[0]?.totalSales ?? 0;
  const totalCount = todayTotals[0]?.totalCount ?? 0;
  const avgTicket = totalCount > 0 ? Math.round((totalSales / totalCount) * 100) / 100 : 0;
  const lastWeekSales = lastWeekTotals[0]?.totalSales ?? 0;
  const vsSameDayLastWeek = lastWeekSales > 0
    ? Math.round(((totalSales - lastWeekSales) / lastWeekSales) * 100)
    : 0;
  const totalProfit = Math.round((totalSales - (profitResult[0]?.totalCost ?? 0)) * 100) / 100;

  const salesByMethod: Record<string, number> = {};
  for (const row of methodBreakdown) {
    salesByMethod[row.method] = row.total;
  }

  return {
    totalSales,
    totalCount,
    avgTicket,
    totalProfit,
    vsSameDayLastWeek,
    topProducts,
    salesByMethod,
  };
}

// ============================================================
// Weekly chart
// ============================================================

export async function fetchWeeklyChart(db: Database, businessId: string) {
  const now = new Date();
  const dayOfWeek = currentDayOfWeekVET(now);
  const todayRange = todayRangeVET(now);
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(todayRange.start.getTime() - mondayOffset * 24 * 60 * 60 * 1000);
  const weekEnd = todayRange.end;

  const dailyBreakdown = await db
    .select({
      day: sql<string>`TO_CHAR(${sales.createdAt} AT TIME ZONE ${APP_TIMEZONE}, 'Dy')`,
      amount: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
    })
    .from(sales)
    .where(
      and(
        eq(sales.businessId, businessId),
        eq(sales.status, "completed"),
        gte(sales.createdAt, weekStart),
        lte(sales.createdAt, weekEnd),
      ),
    )
    .groupBy(
      sql`TO_CHAR(${sales.createdAt} AT TIME ZONE ${APP_TIMEZONE}, 'Dy')`,
      sql`DATE(${sales.createdAt} AT TIME ZONE ${APP_TIMEZONE})`,
    )
    .orderBy(sql`DATE(${sales.createdAt} AT TIME ZONE ${APP_TIMEZONE})`);

  return { dailyBreakdown };
}

// ============================================================
// Financial (gross margin)
// ============================================================

export async function fetchFinancialSummary(db: Database, businessId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [result] = await db
    .select({
      revenue: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float`,
      cost: sql<number>`COALESCE(SUM(${sales.totalCostUsd}::numeric), 0)::float`,
    })
    .from(sales)
    .where(
      and(
        eq(sales.businessId, businessId),
        eq(sales.status, "completed"),
        gte(sales.createdAt, monthStart),
      ),
    );

  const revenue = result?.revenue ?? 0;
  const cost = result?.cost ?? 0;
  const grossMargin = revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : 0;

  return { grossMargin };
}

// ============================================================
// Accounts receivable
// ============================================================

export async function fetchReceivableSummary(db: Database, businessId: string) {
  const [totalResult] = await db
    .select({
      totalPending: sql<number>`COALESCE(SUM(${accountsReceivable.balanceUsd}::numeric), 0)::float`,
    })
    .from(accountsReceivable)
    .where(
      and(
        eq(accountsReceivable.businessId, businessId),
        eq(accountsReceivable.status, "pending"),
      ),
    );

  const accounts = await db
    .select({
      id: accountsReceivable.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      balanceUsd: accountsReceivable.balanceUsd,
      dueDate: accountsReceivable.dueDate,
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
    .orderBy(desc(sql`${accountsReceivable.balanceUsd}::numeric`))
    .limit(20);

  return {
    totalPending: totalResult?.totalPending ?? 0,
    accounts,
  };
}

// ============================================================
// Inventory summary
// ============================================================

export async function fetchInventorySummary(db: Database, businessId: string) {
  const [totals] = await db
    .select({
      lowStock: sql<number>`SUM(CASE WHEN ${products.stock} <= ${products.stockMin} AND ${products.stock} > ${products.stockCritical} THEN 1 ELSE 0 END)::int`,
      criticalStock: sql<number>`SUM(CASE WHEN ${products.stock} <= ${products.stockCritical} THEN 1 ELSE 0 END)::int`,
    })
    .from(products)
    .where(and(eq(products.businessId, businessId), eq(products.isActive, true)));

  return {
    lowStock: totals?.lowStock ?? 0,
    criticalStock: totals?.criticalStock ?? 0,
  };
}

// ============================================================
// Smart alerts
// ============================================================

export async function fetchAlerts(db: Database, businessId: string) {
  const alerts: Array<{
    id: string;
    icon: string;
    title: string;
    suggestion: string;
    actionLabel: string;
    actionTo: string;
    severity: "critical" | "warning" | "info";
  }> = [];

  const [criticalProducts, overdueReceivables] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, stock: products.stock })
      .from(products)
      .where(
        and(
          eq(products.businessId, businessId),
          eq(products.isActive, true),
          sql`${products.stock} <= ${products.stockCritical}`,
          sql`(${products.lastSoldAt} IS NULL OR ${products.lastSoldAt} >= NOW() - INTERVAL '${sql.raw(String(DEAD_STOCK_DAYS))} days')`,
        ),
      )
      .limit(5),
    db
      .select({
        id: accountsReceivable.id,
        balanceUsd: accountsReceivable.balanceUsd,
        createdAt: accountsReceivable.createdAt,
        customerName: customers.name,
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
      .limit(3),
  ]);

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

  for (const r of overdueReceivables) {
    const days = Math.floor((Date.now() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    alerts.push({
      id: `receivable-overdue-${r.id}`,
      icon: "💰",
      title: `${r.customerName} debe $${Number(r.balanceUsd).toFixed(2)} hace ${days} dias`,
      suggestion: "Cobrar lo antes posible.",
      actionLabel: "Ver cuentas",
      actionTo: "/accounts",
      severity: days > 30 ? "critical" : "warning",
    });
  }

  return alerts;
}

// ============================================================
// Cash flow projection
// ============================================================

export async function fetchCashFlow(db: Database, businessId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  const [[revResult], [expResult]] = await Promise.all([
    db
      .select({ total: sql<number>`COALESCE(SUM(${sales.totalUsd}::numeric), 0)::float` })
      .from(sales)
      .where(and(eq(sales.businessId, businessId), eq(sales.status, "completed"), gte(sales.createdAt, thirtyDaysAgo))),
    db
      .select({ total: sql<number>`COALESCE(SUM(${expenses.total}::numeric), 0)::float` })
      .from(expenses)
      .where(and(eq(expenses.businessId, businessId), eq(expenses.status, "confirmed"), gte(expenses.date, thirtyDaysAgo))),
  ]);

  const avgDailyNet = ((revResult?.total ?? 0) - (expResult?.total ?? 0)) / 30;
  return { projection7d: { net: Math.round(avgDailyNet * 7 * 100) / 100 } };
}

// ============================================================
// Exchange rate
// ============================================================

export async function fetchExchangeRate(businessId: string) {
  try {
    const rate = await getCurrentRate(businessId);
    return { rateBcv: Number(rate.rateBcv), rateEur: rate.rateEur ? Number(rate.rateEur) : null };
  } catch {
    return null;
  }
}

// ============================================================
// Pending orders
// ============================================================

export async function fetchPendingOrders(db: Database, businessId: string) {
  const rows = await db
    .select({
      id: orders.id,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.businessId, businessId), eq(orders.status, "pending")))
    .orderBy(desc(orders.createdAt))
    .limit(5);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.businessId, businessId), eq(orders.status, "pending")));

  return {
    pending: rows.map((r) => ({
      id: r.id,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      total: Number(r.total),
      paymentMethod: r.paymentMethod,
      createdAt: r.createdAt.toISOString(),
    })),
    pendingCount: countResult?.count ?? 0,
  };
}

// ============================================================
// Recent sales
// ============================================================

export async function fetchRecentSales(db: Database, businessId: string) {
  const rows = await db
    .select({
      id: sales.id,
      totalUsd: sales.totalUsd,
      channel: sales.channel,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .where(and(eq(sales.businessId, businessId), eq(sales.status, "completed")))
    .orderBy(desc(sales.createdAt))
    .limit(5);

  return rows.map((r) => ({
    id: r.id,
    totalUsd: r.totalUsd,
    channel: r.channel,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ============================================================
// Store settings + stats
// ============================================================

export async function fetchStoreInfo(db: Database, businessId: string) {
  const [settings] = await db
    .select({ storeEnabled: storeSettings.storeEnabled })
    .from(storeSettings)
    .where(eq(storeSettings.businessId, businessId))
    .limit(1);

  const now = new Date();
  const dayOfWeek = currentDayOfWeekVET(now);
  const todayRange = todayRangeVET(now);
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(todayRange.start.getTime() - mondayOffset * 24 * 60 * 60 * 1000);

  const [weekResult] = await db
    .select({
      orderCount: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${orders.total}::numeric), 0)::float`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.businessId, businessId),
        sql`${orders.createdAt} >= ${weekStart.toISOString()}`,
        sql`${orders.status} != 'cancelled'`,
      ),
    );

  return {
    enabled: settings?.storeEnabled ?? false,
    ordersThisWeek: weekResult?.orderCount ?? 0,
    revenueThisWeek: weekResult?.revenue ?? 0,
  };
}
