/**
 * Global authentication middleware.
 *
 * Implements the auth flow from AUTH-REFACTOR-PLAN.md:
 *
 * 1. NovaUser in state?           -> allow (already identified)
 * 2. Route is public?             -> allow
 * 3. Clerk signed in, no NovaUser -> redirect to /auth/resolve
 * 4. Device has cached roster?    -> redirect to /auth/pin (shared device)
 * 5. Nothing                      -> redirect to /landing (new device)
 *
 * The key change from the old middleware: step 4 checks for a cached
 * team roster (not just a businessId). If the roster exists, the device
 * was configured by the owner and employees can use PIN to identify.
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

  // 4. Device has cached roster (owner configured it before) -> PIN screen
  if (import.meta.client) {
    const { hasRoster } = useTeamRoster();
    if (hasRoster()) {
      return navigateTo("/auth/pin");
    }
  }

  // 5. New device, no auth at all -- show landing
  return navigateTo("/landing");
});
