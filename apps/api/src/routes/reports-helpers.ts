/**
 * Shared helpers for report routes.
 *
 * Used by reports-data, reports-pdf, reports-xlsx, and reports-email.
 *
 * All day boundaries use America/Caracas (VET, UTC-4) so that "today",
 * "this week", and "this month" align with Venezuelan business days.
 */

import { z } from "zod";
import {
  todayRangeVET,
  dateRangeVET,
  todayStringVET,
  currentDayOfWeekVET,
} from "@nova/shared";

/** Common period query param schema. */
export const periodQuery = z.object({
  period: z
    .enum(["today", "week", "month", "last_month", "custom"])
    .default("today"),
  from: z.string().optional(),
  to: z.string().optional(),
});

/** Parse period query into VET-aligned date range (returned as UTC Dates). */
export function parsePeriodRange(
  period: string,
  from?: string,
  to?: string,
): { start: Date; end: Date } {
  const now = new Date();

  let start: Date;
  let end: Date;

  switch (period) {
    case "today": {
      const today = todayRangeVET(now);
      start = today.start;
      end = today.end;
      break;
    }
    case "week": {
      // Monday-to-today in VET.
      const dayOfWeek = currentDayOfWeekVET(now); // 0=Sun
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      // Walk back to Monday by subtracting days from today's VET start.
      const today = todayRangeVET(now);
      const mondayStartMs =
        today.start.getTime() - mondayOffset * 24 * 60 * 60 * 1000;
      start = new Date(mondayStartMs);
      end = today.end;
      break;
    }
    case "month": {
      // First day of current month to today, in VET.
      const todayStr = todayStringVET(now);
      const monthStr = todayStr.slice(0, 7); // "YYYY-MM"
      const firstDay = dateRangeVET(`${monthStr}-01`);
      const today = todayRangeVET(now);
      start = firstDay.start;
      end = today.end;
      break;
    }
    case "last_month": {
      // Full previous month in VET.
      const todayStr = todayStringVET(now);
      const [yyyy, mm] = todayStr.split("-").map(Number);
      const prevMonth = mm === 1 ? 12 : mm - 1;
      const prevYear = mm === 1 ? yyyy - 1 : yyyy;
      const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

      // Last day of previous month: day 0 of current month.
      const lastDayNum = new Date(yyyy, mm - 1, 0).getDate();

      start = dateRangeVET(`${prevMonthStr}-01`).start;
      end = dateRangeVET(
        `${prevMonthStr}-${String(lastDayNum).padStart(2, "0")}`,
      ).end;
      break;
    }
    case "custom":
      if (!from || !to) {
        const today = todayRangeVET(now);
        start = today.start;
        end = today.end;
      } else {
        start = dateRangeVET(from).start;
        end = dateRangeVET(to).end;
      }
      break;
    default: {
      const today = todayRangeVET(now);
      start = today.start;
      end = today.end;
    }
  }

  return { start, end };
}
