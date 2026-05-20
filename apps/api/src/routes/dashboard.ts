/**
 * Consolidated dashboard endpoint.
 *
 * GET /dashboard - Returns all dashboard data in a single response.
 *
 * Replaces 12 parallel API calls from the frontend with 1 call.
 * All queries run in parallel on the server (where DB latency is <5ms)
 * instead of sequentially over the network (where RTT is 300-500ms).
 *
 * Each section is independent — if one fails, the others still return data.
 * Uses Promise.allSettled to isolate failures.
 */

import { Hono } from "hono";
import type { AppEnv } from "../types";
import {
  fetchDailyReport,
  fetchWeeklyChart,
  fetchFinancialSummary,
  fetchReceivableSummary,
  fetchInventorySummary,
  fetchAlerts,
  fetchCashFlow,
  fetchExchangeRate,
  fetchPendingOrders,
  fetchRecentSales,
  fetchStoreInfo,
} from "../services/dashboard-queries";

export const dashboardRoutes = new Hono<AppEnv>();

/**
 * GET /dashboard - Consolidated dashboard data.
 *
 * Returns all sections the dashboard needs in one response.
 * Sections that fail return null (graceful degradation).
 */
dashboardRoutes.get("/dashboard", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  // Execute all queries in parallel — server-side latency is <5ms each.
  // Promise.allSettled ensures one failing section doesn't break the rest.
  const [
    daily,
    weekly,
    financial,
    receivable,
    inventory,
    alerts,
    cashFlow,
    rate,
    pendingOrders,
    recentSales,
    store,
  ] = await Promise.allSettled([
    fetchDailyReport(db, businessId),
    fetchWeeklyChart(db, businessId),
    fetchFinancialSummary(db, businessId),
    fetchReceivableSummary(db, businessId),
    fetchInventorySummary(db, businessId),
    fetchAlerts(db, businessId),
    fetchCashFlow(db, businessId),
    fetchExchangeRate(businessId),
    fetchPendingOrders(db, businessId),
    fetchRecentSales(db, businessId),
    fetchStoreInfo(db, businessId),
  ]);

  return c.json({
    today: daily.status === "fulfilled" ? daily.value : null,
    weekly: weekly.status === "fulfilled" ? weekly.value : null,
    financial: financial.status === "fulfilled" ? financial.value : null,
    receivable: receivable.status === "fulfilled" ? receivable.value : null,
    inventory: inventory.status === "fulfilled" ? inventory.value : null,
    alerts: alerts.status === "fulfilled" ? alerts.value : [],
    cashFlow: cashFlow.status === "fulfilled" ? cashFlow.value : null,
    exchangeRate: rate.status === "fulfilled" ? rate.value : null,
    orders: pendingOrders.status === "fulfilled" ? pendingOrders.value : null,
    recentSales: recentSales.status === "fulfilled" ? recentSales.value : [],
    store: store.status === "fulfilled" ? store.value : null,
  });
});
