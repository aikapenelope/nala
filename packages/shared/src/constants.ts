/**
 * Shared constants used across the Nova monorepo.
 */

/** PIN length for employee authentication. */
export const PIN_LENGTH = 4;

/** Maximum failed PIN attempts before lockout. */
export const MAX_PIN_ATTEMPTS = 5;

/** PIN lockout duration in minutes. */
export const PIN_LOCKOUT_MINUTES = 5;

/** Days without movement to mark a product as "dead stock". */
export const DEAD_STOCK_DAYS = 60;

/** Days without purchase to mark a client as "at risk". */
export const CLIENT_AT_RISK_DAYS = 30;

/** Days without purchase to mark a client as "inactive". */
export const CLIENT_INACTIVE_DAYS = 90;

/** Accounts receivable aging thresholds in days. */
export const AGING_THRESHOLDS = {
  green: 15,
  yellow: 30,
} as const;
