/**
 * Excel export service using SheetJS (xlsx).
 *
 * Generates XLSX files for:
 * - Daily summary
 * - Weekly summary
 * - Sellers ranking
 *
 * xlsx has native ESM support — no createRequire workaround needed.
 */

import * as XLSX from "xlsx";

/**
 * Generate an XLSX buffer from a workbook.
 * Returns ArrayBuffer compatible with Hono's c.body().
 */
function workbookToBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
}

/** Add column widths based on header lengths. */
function autoWidth(
  ws: XLSX.WorkSheet,
  headers: string[],
): void {
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 12) }));
}

// ============================================================
// Daily Summary Excel
// ============================================================

export interface DailyExcelData {
  totalSales: number;
  totalCount: number;
  avgTicket: number;
  vsPreviousDay: number;
  vsSameDayLastWeek: number;
  topProducts: Array<{ name: string; qty: number; total: number }>;
  salesByMethod: Record<string, number>;
}

export function generateDailyExcel(data: DailyExcelData): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows = [
    ["Resumen Diario", ""],
    ["", ""],
    ["Ventas totales (USD)", data.totalSales],
    ["Transacciones", data.totalCount],
    ["Ticket promedio (USD)", data.avgTicket],
    ["vs Dia anterior", `${data.vsPreviousDay >= 0 ? "+" : ""}${data.vsPreviousDay}%`],
    ["vs Misma dia semana pasada", `${data.vsSameDayLastWeek >= 0 ? "+" : ""}${data.vsSameDayLastWeek}%`],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 30 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");

  // Top products sheet
  if (data.topProducts.length > 0) {
    const headers = ["Producto", "Cantidad", "Total (USD)"];
    const rows = data.topProducts.map((p) => [p.name, p.qty, p.total]);
    const wsProducts = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    autoWidth(wsProducts, headers);
    XLSX.utils.book_append_sheet(wb, wsProducts, "Top Productos");
  }

  // Payment methods sheet
  const methods = Object.entries(data.salesByMethod);
  if (methods.length > 0) {
    const headers = ["Metodo de Pago", "Total (USD)"];
    const rows = methods.map(([method, total]) => [method, total]);
    const wsMethods = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    autoWidth(wsMethods, headers);
    XLSX.utils.book_append_sheet(wb, wsMethods, "Metodos de Pago");
  }

  return workbookToBuffer(wb);
}

// ============================================================
// Weekly Summary Excel
// ============================================================

export interface WeeklyExcelData {
  totalSales: number;
  totalCount: number;
  vsPrevPeriod: number;
  dailyBreakdown: Array<{ day: string; amount: number }>;
  bestDay: string | null;
  topProduct: string | null;
}

export function generateWeeklyExcel(
  data: WeeklyExcelData,
  period: string,
): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  const periodLabel =
    period === "week"
      ? "Esta semana"
      : period === "month"
        ? "Este mes"
        : period === "last_month"
          ? "Mes anterior"
          : "Periodo";

  // Summary sheet
  const summaryRows = [
    [`Resumen: ${periodLabel}`, ""],
    ["", ""],
    ["Ventas totales (USD)", data.totalSales],
    ["Transacciones", data.totalCount],
    ["vs Periodo anterior", `${data.vsPrevPeriod >= 0 ? "+" : ""}${data.vsPrevPeriod}%`],
    ["Mejor dia", data.bestDay ?? "N/A"],
    ["Producto estrella", data.topProduct ?? "N/A"],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");

  // Daily breakdown sheet
  if (data.dailyBreakdown.length > 0) {
    const headers = ["Dia", "Ventas (USD)"];
    const rows = data.dailyBreakdown.map((d) => [d.day, d.amount]);
    const wsDaily = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    autoWidth(wsDaily, headers);
    XLSX.utils.book_append_sheet(wb, wsDaily, "Desglose Diario");
  }

  return workbookToBuffer(wb);
}

// ============================================================
// Sellers Ranking Excel
// ============================================================

export interface SellersExcelData {
  sellers: Array<{
    name: string;
    sales: number;
    total: number;
    avgTicket: number;
  }>;
}

export function generateSellersExcel(data: SellersExcelData): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  const headers = ["Vendedor", "Ventas", "Total (USD)", "Ticket Promedio (USD)"];
  const rows = data.sellers.map((s) => [s.name, s.sales, s.total, s.avgTicket]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  autoWidth(ws, headers);
  XLSX.utils.book_append_sheet(wb, ws, "Vendedores");

  return workbookToBuffer(wb);
}


