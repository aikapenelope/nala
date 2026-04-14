/**
 * Global authentication middleware.
 *
 * Implements the auth flow with subdomain-aware tenant detection:
 *
 * 1. NovaUser in state?           -> allow (already identified)
 * 2. Route is public?             -> allow
 * 3. On tenant subdomain + no auth? -> show catalog (public storefront)
 * 4. Clerk signed in, no NovaUser -> redirect to /auth/resolve
 * 5. Device has cached roster?    -> redirect to /auth/pin (shared device)
 * 6. Nothing                      -> redirect to /landing (new device)
 *
 * When on a tenant subdomain (e.g., bodegadonpedro.novaincs.com):
 * - Unauthenticated visitors see the public catalog
 * - Employees with cached roster see the PIN screen
 * - The subdomain identifies the business without localStorage
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

  // 3. On a tenant subdomain with no auth -> show public catalog
  const { tenantSlug } = useTenant();
  if (tenantSlug.value) {
    // Check if there's a cached roster for this device first
    if (import.meta.client) {
      const { hasRoster } = useTeamRoster();
      if (hasRoster()) {
        return navigateTo("/auth/pin");
      }
    }

    // No roster, no auth -> show the public catalog for this tenant
    return navigateTo(`/catalogo/${tenantSlug.value}`);
  }

  // 4. Clerk signed in but NovaUser not resolved yet
  if (import.meta.client) {
    try {
      const { isSignedIn } = useAuth();
      if (isSignedIn.value) {
        return navigateTo("/auth/resolve");
      }
    } catch {
      // Clerk not initialized -- continue to next check
    }
  }

  // 5. Device has cached roster (owner configured it before) -> PIN screen
  if (import.meta.client) {
    const { hasRoster } = useTeamRoster();
    if (hasRoster()) {
      return navigateTo("/auth/pin");
    }
  }

  // 6. New device, no auth at all -- show landing
  return navigateTo("/landing");
});
