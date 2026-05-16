/**
 * Tests for timezone utilities.
 *
 * These tests use fixed UTC instants to verify that VET (America/Caracas, UTC-4)
 * day boundaries, hour, and day-of-week calculations are correct.
 */

import { describe, it, expect } from "vitest";
import {
  APP_TIMEZONE,
  APP_LOCALE,
  todayRangeVET,
  dateRangeVET,
  todayStringVET,
  currentHourVET,
  currentDayOfWeekVET,
  formatDateVET,
  formatDateTimeVET,
  formatTimeVET,
} from "../timezone";

describe("constants", () => {
  it("APP_TIMEZONE is America/Caracas", () => {
    expect(APP_TIMEZONE).toBe("America/Caracas");
  });

  it("APP_LOCALE is es-VE", () => {
    expect(APP_LOCALE).toBe("es-VE");
  });
});

describe("todayRangeVET", () => {
  it("returns VET day boundaries for a midday UTC time", () => {
    // 2026-05-20T15:00:00Z = 11:00am VET on May 20
    const now = new Date("2026-05-20T15:00:00.000Z");
    const { start, end, dateStr } = todayRangeVET(now);

    expect(dateStr).toBe("2026-05-20");
    // Midnight VET = 04:00 UTC
    expect(start.toISOString()).toBe("2026-05-20T04:00:00.000Z");
    // 23:59:59.999 VET = 03:59:59.999 UTC next day
    expect(end.toISOString()).toBe("2026-05-21T03:59:59.999Z");
  });

  it("handles late-night VET correctly (UTC is next day)", () => {
    // 2026-05-21T02:00:00Z = 10:00pm VET on May 20 (still May 20 in Caracas)
    const now = new Date("2026-05-21T02:00:00.000Z");
    const { start, end, dateStr } = todayRangeVET(now);

    expect(dateStr).toBe("2026-05-20");
    expect(start.toISOString()).toBe("2026-05-20T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-21T03:59:59.999Z");
  });

  it("handles early-morning VET correctly (just after midnight VET)", () => {
    // 2026-05-20T04:30:00Z = 00:30am VET on May 20
    const now = new Date("2026-05-20T04:30:00.000Z");
    const { start, end, dateStr } = todayRangeVET(now);

    expect(dateStr).toBe("2026-05-20");
    expect(start.toISOString()).toBe("2026-05-20T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-21T03:59:59.999Z");
  });

  it("handles exact midnight VET boundary", () => {
    // 2026-05-20T04:00:00.000Z = exactly midnight VET on May 20
    const now = new Date("2026-05-20T04:00:00.000Z");
    const { start, dateStr } = todayRangeVET(now);

    expect(dateStr).toBe("2026-05-20");
    expect(start.toISOString()).toBe("2026-05-20T04:00:00.000Z");
  });

  it("handles just before midnight VET (end of previous day)", () => {
    // 2026-05-20T03:59:59.000Z = 11:59:59pm VET on May 19
    const now = new Date("2026-05-20T03:59:59.000Z");
    const { dateStr } = todayRangeVET(now);

    expect(dateStr).toBe("2026-05-19");
  });
});

describe("dateRangeVET", () => {
  it("returns correct boundaries for a specific date", () => {
    const { start, end } = dateRangeVET("2026-05-20");

    expect(start.toISOString()).toBe("2026-05-20T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-21T03:59:59.999Z");
  });

  it("handles January 1st (year boundary)", () => {
    const { start, end } = dateRangeVET("2026-01-01");

    expect(start.toISOString()).toBe("2026-01-01T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-02T03:59:59.999Z");
  });

  it("handles December 31st", () => {
    const { start, end } = dateRangeVET("2025-12-31");

    expect(start.toISOString()).toBe("2025-12-31T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-01T03:59:59.999Z");
  });

  it("handles leap year Feb 29", () => {
    const { start, end } = dateRangeVET("2028-02-29");

    expect(start.toISOString()).toBe("2028-02-29T04:00:00.000Z");
    expect(end.toISOString()).toBe("2028-03-01T03:59:59.999Z");
  });

  it("throws on invalid date string", () => {
    expect(() => dateRangeVET("invalid")).toThrow("Invalid date string");
    expect(() => dateRangeVET("2026-13-01")).not.toThrow(); // month 13 is handled by Date
    expect(() => dateRangeVET("")).toThrow("Invalid date string");
  });
});

describe("todayStringVET", () => {
  it("returns YYYY-MM-DD in VET", () => {
    // 2026-05-21T02:00:00Z = 10pm VET on May 20
    const now = new Date("2026-05-21T02:00:00.000Z");
    expect(todayStringVET(now)).toBe("2026-05-20");
  });

  it("returns next day after midnight VET", () => {
    // 2026-05-20T04:30:00Z = 00:30am VET on May 20
    const now = new Date("2026-05-20T04:30:00.000Z");
    expect(todayStringVET(now)).toBe("2026-05-20");
  });
});

describe("currentHourVET", () => {
  it("returns correct hour for midday UTC", () => {
    // 15:00 UTC = 11:00 VET
    const now = new Date("2026-05-20T15:00:00.000Z");
    expect(currentHourVET(now)).toBe(11);
  });

  it("returns correct hour for late night UTC (early morning VET)", () => {
    // 06:00 UTC = 02:00 VET
    const now = new Date("2026-05-20T06:00:00.000Z");
    expect(currentHourVET(now)).toBe(2);
  });

  it("returns 0 at midnight VET", () => {
    // 04:00 UTC = 00:00 VET
    const now = new Date("2026-05-20T04:00:00.000Z");
    expect(currentHourVET(now)).toBe(0);
  });

  it("returns 23 at 11pm VET", () => {
    // 03:00 UTC = 23:00 VET (previous day)
    const now = new Date("2026-05-20T03:00:00.000Z");
    expect(currentHourVET(now)).toBe(23);
  });
});

describe("currentDayOfWeekVET", () => {
  it("returns correct day for a Wednesday in VET", () => {
    // 2026-05-20 is a Wednesday. 15:00 UTC = 11:00 VET, still Wednesday.
    const now = new Date("2026-05-20T15:00:00.000Z");
    expect(currentDayOfWeekVET(now)).toBe(3); // Wed
  });

  it("handles day boundary: UTC is Thursday but VET is still Wednesday", () => {
    // 2026-05-21T02:00:00Z = Thursday 2am UTC = Wednesday 10pm VET
    const now = new Date("2026-05-21T02:00:00.000Z");
    expect(currentDayOfWeekVET(now)).toBe(3); // Wed in VET
  });

  it("returns Sunday = 0", () => {
    // 2026-05-17 is a Sunday
    const now = new Date("2026-05-17T15:00:00.000Z");
    expect(currentDayOfWeekVET(now)).toBe(0);
  });
});

describe("formatDateVET", () => {
  it("formats a date with explicit VET timezone", () => {
    const result = formatDateVET(new Date("2026-05-20T15:00:00.000Z"), {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    // Should contain "20" (the day in VET)
    expect(result).toContain("20");
    expect(result).toContain("2026");
  });

  it("accepts string input", () => {
    const result = formatDateVET("2026-05-20T15:00:00.000Z", {
      day: "numeric",
    });
    expect(result).toContain("20");
  });
});

describe("formatDateTimeVET", () => {
  it("includes time in VET", () => {
    // 15:00 UTC = 11:00 VET
    const result = formatDateTimeVET(new Date("2026-05-20T15:00:00.000Z"), {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    expect(result).toContain("11");
  });
});

describe("formatTimeVET", () => {
  it("formats time in VET", () => {
    // 15:00 UTC = 11:00 VET
    const result = formatTimeVET(new Date("2026-05-20T15:00:00.000Z"), {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    expect(result).toContain("11");
    expect(result).toContain("00");
  });
});
