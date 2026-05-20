/**
 * Routes that require Owner Lock PIN to access.
 *
 * Used by the owner-lock.global.ts middleware (navigation guard)
 * and the auto-redirect watcher (timer expiry).
 *
 * Settings is NOT locked (it's where the PIN is configured).
 * POS (/sales, /sales/checkout) is NOT locked (employees need to sell).
 */
export const LOCKED_ROUTES = [
  "/reports",
  "/accounting",
  "/accounts",
  "/suppliers",
  "/sales/history",
  "/sales/quotations",
  "/clients",
];
