/**
 * Shared helpers for report routes.
 *
 * Used by reports-data, reports-pdf, reports-xlsx, and reports-email.
 */

import { z } from "zod";

/** Common period query param schema. */
export const periodQuery = z.object({
  period: z
    .enum(["today", "week", "month", "last_month", "custom"])
    .default("today"),
  from: z.string().optional(),
  to: z.string().optional(),
});

/** Parse period query into UTC date range. */
export function parsePeriodRange(
  period: string,
  from?: string,
  to?: string,
): { start: Date; end: Date } {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  let start: Date;
  let end: Date;

  switch (period) {
    case "today":
      start = new Date(`${todayStr}T00:00:00.000Z`);
      end = new Date(`${todayStr}T23:59:59.999Z`);
      break;
    case "week": {
      const dayOfWeek = now.getUTCDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() - mondayOffset);
      start = new Date(monday.toISOString().split("T")[0] + "T00:00:00.000Z");
      end = new Date(`${todayStr}T23:59:59.999Z`);
      break;
    }
    case "month": {
      const monthStr = todayStr.slice(0, 7);
      start = new Date(`${monthStr}-01T00:00:00.000Z`);
      end = new Date(`${todayStr}T23:59:59.999Z`);
      break;
    }
    case "last_month": {
      const lastMonth = new Date(now);
      lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
      const lmStr = lastMonth.toISOString().split("T")[0].slice(0, 7);
      start = new Date(`${lmStr}-01T00:00:00.000Z`);
      const lastDay = new Date(now.getUTCFullYear(), now.getUTCMonth(), 0);
      end = new Date(lastDay.toISOString().split("T")[0] + "T23:59:59.999Z");
      break;
    }
    case "custom":
      if (!from || !to) {
        start = new Date(`${todayStr}T00:00:00.000Z`);
        end = new Date(`${todayStr}T23:59:59.999Z`);
      } else {
        start = new Date(`${from}T00:00:00.000Z`);
        end = new Date(`${to}T23:59:59.999Z`);
      }
      break;
    default:
      start = new Date(`${todayStr}T00:00:00.000Z`);
      end = new Date(`${todayStr}T23:59:59.999Z`);
  }

  return { start, end };
}
