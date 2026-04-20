/**
 * Global authentication middleware.
 *
 * Device-mode aware auth flow:
 *
 * STORE MODE (shared tablet at the counter):
 *   1. NovaUser in state?        -> allow (employee identified via PIN)
 *   2. Route is public?          -> allow
 *   3. Has cached roster?        -> redirect to /auth/pin
 *   4. Nothing                   -> redirect to /auth/pin (shows "not configured")
 *
 * OWNER MODE (admin's personal device):
 *   1. NovaUser in state?        -> allow (owner identified)
 *   2. Route is public?          -> allow
 *   3. On tenant subdomain?      -> show catalog or PIN
 *   4. Clerk signed in?          -> redirect to /auth/resolve
 *   5. Has cached roster?        -> redirect to /auth/pin
 *   6. Nothing                   -> redirect to /landing
 */

/** Routes accessible without authentication. */
const PUBLIC_ROUTES = [
  "/landing",
  "/auth/login",
  "/auth/signup",
  "/auth/pin",
  "/auth/resolve",
  "/onboarding",
  "/catalogo",
];

export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated } = useNovaAuth();

  // 1. Already identified -- allow
  if (isAuthenticated.value) {
    return;
  }

  // 2. Public route -- allow
  const isPublic = PUBLIC_ROUTES.some(
    (route) => to.path === route || to.path.startsWith(route + "/"),
  );
  if (isPublic) {
    return;
  }

  if (!import.meta.client) return;

  const { isStoreMode } = useDeviceMode();

  // STORE MODE: always go to PIN screen
  if (isStoreMode.value) {
    return navigateTo("/auth/pin");
  }

  // OWNER MODE: follow the full auth flow

  // 3. On a tenant subdomain with no auth -> show public catalog
  const { tenantSlug } = useTenant();
  if (tenantSlug.value) {
    const { hasRoster } = useTeamRoster();
    if (hasRoster()) {
      return navigateTo("/auth/pin");
    }
    return navigateTo(`/catalogo/${tenantSlug.value}`);
  }

  // 4. Clerk signed in but NovaUser not resolved yet
  try {
    const { isSignedIn } = useAuth();
    if (isSignedIn.value) {
      return navigateTo("/auth/resolve");
    }
  } catch {
    // Clerk not initialized -- continue to next check
  }

  // 5. Device has cached roster (owner configured it before) -> PIN screen
  const { hasRoster } = useTeamRoster();
  if (hasRoster()) {
    return navigateTo("/auth/pin");
  }

  // 6. New device, no auth at all -- show landing
  return navigateTo("/landing");
});
