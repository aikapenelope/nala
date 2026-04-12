/**
 * Global authentication middleware.
 *
 * Implements the Square-inspired auth flow from AUTH-FLOW-ANALYSIS.md:
 *
 * 1. NovaUser in state?           -> allow (already authenticated)
 * 2. Route is public?             -> allow
 * 3. Clerk signed in, no NovaUser -> redirect to /auth/resolve (calls /api/me)
 * 4. Device has businessId?       -> redirect to /auth/pin (shared device)
 * 5. Nothing                      -> redirect to /landing (new device)
 *
 * The key insight from Square: a configured device (one where the owner
 * logged in at least once) should always show the PIN screen, never the
 * landing page. The device stays bound to the business via localStorage.
 */

/** Routes accessible without authentication. */
const PUBLIC_ROUTES = [
  "/landing",
  "/auth/login",
  "/auth/pin",
  "/auth/resolve",
  "/onboarding",
];

export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated, getDeviceBusinessId } = useNovaAuth();

  // 1. Already authenticated -- allow
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

  // 3. Clerk signed in but NovaUser not resolved yet
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

  // 4. Device has businessId (owner logged in before) -- show PIN screen
  //    This is the Square pattern: the tablet always shows PIN, not landing.
  if (import.meta.client) {
    const deviceBusinessId = getDeviceBusinessId();
    if (deviceBusinessId) {
      return navigateTo("/auth/pin");
    }
  }

  // 5. New device, no auth at all -- show landing
  return navigateTo("/landing");
});
