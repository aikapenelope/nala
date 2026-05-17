/**
 * Owner Lock route guard.
 *
 * Redirects to /unlock when the user tries to access a locked page
 * and the owner lock is active. This is a Nuxt route middleware,
 * the standard pattern for protecting routes.
 *
 * Protected routes: /reports, /accounting, /accounts
 *
 * Flow:
 * 1. User navigates to /reports
 * 2. Middleware checks: is lock enabled? is user unlocked?
 * 3. If locked -> redirect to /unlock?redirect=/reports
 * 4. /unlock page shows PIN pad
 * 5. User enters PIN -> composable sets unlocked=true -> redirect back
 */

const LOCKED_ROUTES = ["/reports", "/accounting", "/accounts"];

export default defineNuxtRouteMiddleware(async (to) => {
  // Only run on client (lock is a client-side UX feature)
  if (!import.meta.client) return;

  // Only check locked routes
  const isLockedRoute = LOCKED_ROUTES.some(
    (r) => to.path === r || to.path.startsWith(r + "/"),
  );
  if (!isLockedRoute) return;

  // Don't redirect if already going to unlock page
  if (to.path === "/unlock") return;

  const { isLocked, ensureInitialized } = useOwnerLock();

  // Ensure we know the lock status
  await ensureInitialized();

  // If locked, redirect to unlock page with return URL
  if (isLocked.value) {
    return navigateTo({
      path: "/unlock",
      query: { redirect: to.fullPath },
    });
  }
});
