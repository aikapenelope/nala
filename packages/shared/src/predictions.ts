/**
 * Prediction and anomaly detection utilities.
 *
 * Used by the dashboard and reports to surface actionable insights:
 * - Stock depletion prediction ("runs out in ~X days")
 * - Period-over-period comparisons
 * - Anomaly detection (unusual voids, atypical sales)
 * - Cash flow alerts
 */

/**
 * Predict days until a product runs out of stock.
 * Based on average daily sales velocity over the last 30 days.
 *
 * Returns null if no sales data or stock is 0.
 */
export function predictStockDepletion(
  currentStock: number,
  salesLast30Days: number,
): number | null {
  if (currentStock <= 0) return 0;
  if (salesLast30Days <= 0) return null;

  const dailyVelocity = salesLast30Days / 30;
  return Math.round(currentStock / dailyVelocity);
}

/**
 * Calculate period-over-period change percentage.
 * Returns the % change from previous to current.
 */
export function periodChange(
  current: number,
  previous: number,
): { percent: number; positive: boolean } {
  if (previous === 0) {
    return { percent: current > 0 ? 100 : 0, positive: current >= 0 };
  }
  const percent =
    Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
  return { percent: Math.abs(percent), positive: percent >= 0 };
}

/** Anomaly types that Nova can detect. */
export type AnomalyType =
  | "high_voids"
  | "unusual_discount"
  | "sales_spike"
  | "sales_drop"
  | "cash_deficit";

/** An anomaly detected in the business data. */
export interface Anomaly {
  type: AnomalyType;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  actionLabel?: string;
  actionTo?: string;
}

/**
 * Detect anomalies in today's sales data.
 *
 * Checks:
 * 1. Void rate above average (>2x normal)
 * 2. Discount rate above threshold (>15% of revenue)
 * 3. Sales significantly above/below average (>2 std dev)
 * 4. Projected cash deficit in next 7 days
 */
export function detectAnomalies(input: {
  todayVoids: number;
  avgDailyVoids: number;
  todayDiscountTotal: number;
  todayRevenue: number;
  todaySales: number;
  avgDailySales: number;
  salesStdDev: number;
  projectedCashIn7Days: number;
  projectedExpensesIn7Days: number;
}): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // High void rate
  if (
    input.avgDailyVoids > 0 &&
    input.todayVoids > input.avgDailyVoids * 2
  ) {
    anomalies.push({
      type: "high_voids",
      severity: "warning",
      title: `${input.todayVoids} anulaciones hoy (promedio: ${input.avgDailyVoids.toFixed(1)})`,
      detail: "Revisa si hay un patrón o error recurrente",
      actionLabel: "Ver historial",
      actionTo: "/sales/history",
    });
  }

  // Unusual discounts
  if (
    input.todayRevenue > 0 &&
    input.todayDiscountTotal / input.todayRevenue > 0.15
  ) {
    const pct = Math.round(
      (input.todayDiscountTotal / input.todayRevenue) * 100,
    );
    anomalies.push({
      type: "unusual_discount",
      severity: "info",
      title: `Descuentos representan ${pct}% de las ventas hoy`,
      detail: "Verifica que los descuentos estén autorizados",
    });
  }

  // Sales spike (>2 std dev above average)
  if (
    input.salesStdDev > 0 &&
    input.todaySales > input.avgDailySales + 2 * input.salesStdDev
  ) {
    anomalies.push({
      type: "sales_spike",
      severity: "info",
      title: "Ventas inusualmente altas hoy",
      detail: `$${input.todaySales.toFixed(0)} vs promedio $${input.avgDailySales.toFixed(0)}`,
    });
  }

  // Sales drop (>2 std dev below average)
  if (
    input.salesStdDev > 0 &&
    input.todaySales < input.avgDailySales - 2 * input.salesStdDev &&
    input.todaySales >= 0
  ) {
    anomalies.push({
      type: "sales_drop",
      severity: "warning",
      title: "Ventas inusualmente bajas hoy",
      detail: `$${input.todaySales.toFixed(0)} vs promedio $${input.avgDailySales.toFixed(0)}`,
    });
  }

  // Cash flow deficit projection
  const projectedBalance =
    input.projectedCashIn7Days - input.projectedExpensesIn7Days;
  if (projectedBalance < 0) {
    anomalies.push({
      type: "cash_deficit",
      severity: "critical",
      title: `Déficit de caja proyectado: $${Math.abs(projectedBalance).toFixed(0)} en 7 días`,
      detail: "Sugerencia: cobra las cuentas pendientes más antiguas",
      actionLabel: "Ver cuentas",
      actionTo: "/accounts",
    });
  }

  return anomalies;
}
