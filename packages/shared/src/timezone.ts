/**
 * Timezone utilities for Nova.
 *
 * Nova is a Venezuelan POS/ERP system. All business-day logic
 * (reports, day-close, sales filters, dashboards) must align with
 * Venezuela Standard Time (VET, UTC-4, IANA "America/Caracas").
 *
 * The database stores all timestamps as `timestamptz` (UTC instants),
 * which is correct. These utilities convert UTC instants into
 * Caracas-local day boundaries for queries and display.
 *
 * Design decisions:
 * - No external dependencies (no dayjs/luxon). Uses `Intl.DateTimeFormat`.
 * - Single constant `APP_TIMEZONE` so a future offset change requires
 *   editing one line.
 * - Offset is computed dynamically via `Intl` so it would survive a
 *   hypothetical DST change (Venezuela abolished DST, but correctness
 *   costs nothing here).
 */

// ============================================================
// Constants
// ============================================================

/** IANA timezone for all business-day logic. */
export const APP_TIMEZONE = "America/Caracas" as const;

/**
 * Locale used for user-facing date/time formatting.
 * "es-VE" = Spanish (Venezuela).
 */
export const APP_LOCALE = "es-VE" as const;

// ============================================================
// Internal helpers
// ============================================================

/**
 * Get the UTC offset in minutes for `APP_TIMEZONE` at a given instant.
 *
 * Uses `Intl.DateTimeFormat` to extract the offset without any
 * external library. Returns a negative number for west-of-UTC
 * (e.g. -240 for UTC-4).
 */
function getTimezoneOffsetMinutes(at: Date = new Date()): number {
  // Format the date in the target timezone to extract its local components.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };

  // Build a UTC timestamp from the local components.
  const localAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );

  // offset = localAsUtc - actualUtc  →  positive means east of UTC.
  // We return negative for west (matching JS getTimezoneOffset convention inverted).
  return Math.round((localAsUtc - at.getTime()) / 60_000);
}

// ============================================================
// Day-boundary helpers (for DB queries)
// ============================================================

/**
 * Return the start and end of "today" in `APP_TIMEZONE` as UTC `Date` objects.
 *
 * Example for 2026-05-20 in Caracas (UTC-4):
 *   start = 2026-05-20T04:00:00.000Z  (midnight Caracas = 04:00 UTC)
 *   end   = 2026-05-21T03:59:59.999Z  (23:59:59.999 Caracas)
 *
 * These are the values you pass to `gte(sales.createdAt, start)` and
 * `lte(sales.createdAt, end)` in Drizzle queries.
 */
export function todayRangeVET(now: Date = new Date()): {
  start: Date;
  end: Date;
  /** The local date string in YYYY-MM-DD format. */
  dateStr: string;
} {
  const offsetMin = getTimezoneOffsetMinutes(now);
  // Local time = UTC + offset
  const localMs = now.getTime() + offsetMin * 60_000;
  const localDate = new Date(localMs);

  const yyyy = localDate.getUTCFullYear();
  const mm = String(localDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(localDate.getUTCDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  // Midnight local = midnight UTC minus offset
  const midnightLocalUtcMs = Date.UTC(yyyy, localDate.getUTCMonth(), localDate.getUTCDate()) - offsetMin * 60_000;

  return {
    start: new Date(midnightLocalUtcMs),
    end: new Date(midnightLocalUtcMs + 24 * 60 * 60 * 1000 - 1),
    dateStr,
  };
}

/**
 * Return the start and end of a specific date (YYYY-MM-DD) in `APP_TIMEZONE`
 * as UTC `Date` objects.
 *
 * Use this when the user sends a date filter like `?date=2026-05-15`.
 */
export function dateRangeVET(dateStr: string): { start: Date; end: Date } {
  const [yyyy, mm, dd] = dateStr.split("-").map(Number);
  if (!yyyy || !mm || !dd) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  // Build a Date at noon local to safely compute the offset for that day.
  // (Noon avoids edge cases around midnight DST transitions.)
  const noonUtcGuess = Date.UTC(yyyy, mm - 1, dd, 12, 0, 0);
  const offsetMin = getTimezoneOffsetMinutes(new Date(noonUtcGuess));

  // Midnight local in UTC
  const midnightLocalUtcMs = Date.UTC(yyyy, mm - 1, dd) - offsetMin * 60_000;

  return {
    start: new Date(midnightLocalUtcMs),
    end: new Date(midnightLocalUtcMs + 24 * 60 * 60 * 1000 - 1),
  };
}

/**
 * Get the current date string (YYYY-MM-DD) in `APP_TIMEZONE`.
 */
export function todayStringVET(now: Date = new Date()): string {
  return todayRangeVET(now).dateStr;
}

/**
 * Get the current hour (0-23) in `APP_TIMEZONE`.
 * Useful for greetings ("Buenos dias" / "Buenas tardes" / "Buenas noches").
 */
export function currentHourVET(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hourPart = parts.find((p) => p.type === "hour");
  const h = hourPart ? Number(hourPart.value) : 0;
  return h === 24 ? 0 : h;
}

/**
 * Get the current day of week (0=Sun, 1=Mon, ..., 6=Sat) in `APP_TIMEZONE`.
 * Useful for business hours checks.
 */
export function currentDayOfWeekVET(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
  }).formatToParts(now);
  const wdPart = parts.find((p) => p.type === "weekday");
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wdPart?.value ?? "Sun"] ?? 0;
}

// ============================================================
// Formatting helpers (for display)
// ============================================================

/**
 * Format a date for display in Venezuelan locale with explicit timezone.
 *
 * Always uses `APP_TIMEZONE` so SSR output matches client output
 * regardless of server timezone.
 */
export function formatDateVET(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    ...options,
  });
}

/**
 * Format a date+time for display in Venezuelan locale with explicit timezone.
 */
export function formatDateTimeVET(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    ...options,
  });
}

/**
 * Format only the time portion for display.
 */
export function formatTimeVET(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    ...options,
  });
}
