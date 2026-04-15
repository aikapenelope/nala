/**
 * Email export route for reports.
 *
 * POST /reports/send-email - Generate PDF and send via Resend.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { sales, saleItems, products, expenses } from "@nova/db";
import {
  generateDailyPdf,
  generateWeeklyPdf,
  generateFinancialPdf,
} from "../services/pdf-generator";
import { sendReportEmail } from "../services/email";
import { parsePeriodRange } from "./reports-helpers";
import type { AppEnv } from "../types";

export const reportsEmail = new Hono<AppEnv>();

const sendEmailSchema = z.object({
  to: z.string().email("Email invalido"),
  reportType: z.enum(["daily", "weekly", "financial"]),
  period: z
    .enum(["today", "week", "month", "last_month", "custom"])
    .default("today"),
});

/**
 * POST /reports/send-email - Generate PDF and send via email.
 *
 * Body: { to: "contador@email.com", reportType: "daily", period: "today" }
 */
reportsEmail.post(
  "/reports/send-email",
  zValidator("json", sendEmailSchema),
  async (c) => {
    const { to, reportType, period } = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");
    const user = c.get("user");

    const periodLabels: Record<string, string> = {
      today: "Hoy",
      week: "Esta semana",
      month: "Este mes",
      last_month: "Mes anterior",
    };
    const periodLabel = periodLabels[period] ?? period;

    const reportLabels: Record<string, string> = {
      daily: "Resumen Diario",
      weekly: "Resumen Semanal",
      financial: "Estado de Resultados",
    };
    const reportLabel = reportLabels[reportType] ?? reportType;

    let pdfBuffer: ArrayBuffer;
    const dateStr = new Date().toISOString().split("T")[0];

    try {
      if (reportType === "daily") {
        const todayStr = new Date().toISOString().split("T")[0];
        const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
        const todayEnd = new Date(`${todayStr}T23:59:59.999Z`);
        const completedCond = eq(sales.status, "completed");
        const bizCond = eq(sales.businessId, businessId);

        const [totals] = await db
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

        const totalSales = totals?.totalSales ?? 0;
        const totalCount = totals?.totalCount ?? 0;

        pdfBuffer = await generateDailyPdf(
          {
            totalSales,
            totalCount,
            avgTicket:
              totalCount > 0
                ? Math.round((totalSales / totalCount) * 100) / 100
                : 0,
            vsPreviousDay: 0,
            vsSameDayLastWeek: 0,
            topProducts,
            salesByMethod: {},
          },
          user.businessName,
        );
      } else if (reportType === "weekly") {
        const { start, end } = parsePeriodRange(period);
        const completedCond = eq(sales.status, "completed");
        const bizCond = eq(sales.businessId, businessId);

        const [totals] = await db
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

        pdfBuffer = await generateWeeklyPdf(
          {
            totalSales: totals?.totalSales ?? 0,
            totalCount: totals?.totalCount ?? 0,
            vsPrevPeriod: 0,
            dailyBreakdown: [],
            bestDay: null,
            topProduct: null,
          },
          user.businessName,
          period,
        );
      } else {
        const { start, end } = parsePeriodRange(period);

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

        pdfBuffer = await generateFinancialPdf(
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
              revenue > 0
                ? Math.round((netProfit / revenue) * 1000) / 10
                : 0,
          },
          user.businessName,
          period,
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error generando reporte";
      return c.json({ error: `No se pudo generar el PDF: ${message}` }, 500);
    }

    try {
      const messageId = await sendReportEmail({
        to,
        subject: `${reportLabel} - ${user.businessName} (${dateStr})`,
        businessName: user.businessName,
        reportType: reportLabel,
        period: periodLabel,
        pdfBuffer,
        pdfFilename: `${reportType}-${dateStr}.pdf`,
      });

      return c.json({ success: true, messageId });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error enviando email";
      return c.json({ error: message }, 500);
    }
  },
);
