/**
 * GET /reports/purchase-book - Purchase book (libro de compras).
 *
 * Lists all expenses/purchases for a period with supplier info,
 * invoice number, amounts, and IVA. Required by SENIAT for
 * formal businesses.
 *
 * Query params: period (week/month/quarter), from, to
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { expenses, suppliers } from "@nova/db";
import { parsePeriodRange, periodQuery } from "./reports-helpers";
import type { AppEnv } from "../types";

const purchaseBook = new Hono<AppEnv>();

purchaseBook.get(
  "/reports/purchase-book",
  zValidator("query", periodQuery),
  async (c) => {
    const query = c.req.valid("query");
    const db = c.get("db");
    const businessId = c.get("businessId");
    const { start, end } = parsePeriodRange(query.period, query.from, query.to);

    const rows = await db
      .select({
        id: expenses.id,
        date: expenses.date,
        supplierName: expenses.supplierName,
        supplierId: expenses.supplierId,
        invoiceNumber: expenses.invoiceNumber,
        total: expenses.total,
        status: expenses.status,
        createdAt: expenses.createdAt,
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
      .orderBy(desc(expenses.date));

    // Enrich with supplier RIF if linked
    const supplierIds = rows
      .map((r) => r.supplierId)
      .filter((id): id is string => id !== null);

    let supplierMap: Record<string, { name: string; rif: string | null }> = {};
    if (supplierIds.length > 0) {
      const uniqueIds = [...new Set(supplierIds)];
      const supplierRows = await db
        .select({
          id: suppliers.id,
          name: suppliers.name,
          rif: suppliers.rif,
        })
        .from(suppliers)
        .where(eq(suppliers.businessId, businessId));

      supplierMap = Object.fromEntries(
        supplierRows
          .filter((s) => uniqueIds.includes(s.id))
          .map((s) => [s.id, { name: s.name, rif: s.rif }]),
      );
    }

    const totalPurchases = rows.reduce((sum, r) => sum + Number(r.total), 0);

    const entries = rows.map((r) => ({
      id: r.id,
      date: r.date.toISOString().split("T")[0],
      supplierName: r.supplierName ?? supplierMap[r.supplierId ?? ""]?.name ?? "Sin proveedor",
      supplierRif: supplierMap[r.supplierId ?? ""]?.rif ?? null,
      invoiceNumber: r.invoiceNumber,
      total: Number(r.total),
    }));

    return c.json({
      entries,
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      count: entries.length,
      period: query.period,
    });
  },
);

export { purchaseBook };
