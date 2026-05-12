/**
 * Global authentication middleware.
 *
 * Simple flow:
 * 1. Storefront (tenant subdomain) routes bypass auth entirely.
 * 2. Public routes always pass through.
 * 3. If Clerk hasn't loaded yet, allow (avoid premature redirects).
 * 4. If signed in with Clerk, allow (resolve page handles the rest).
 * 5. If not signed in, redirect to /landing.
 *
 * No Organizations complexity. Single admin user.
 */

const isPublicRoute = createRouteMatcher([
  "/landing",
  "/auth/login",
  "/auth/signup",
  "/auth/resolve",
  "/onboarding(.*)",
  "/tienda(.*)",
]);

export default defineNuxtRouteMiddleware((to) => {
  // Storefront: tenant subdomain detected, no auth required
  const { hasTenant } = useTenant();
  if (hasTenant.value) {
    return;
  }

  if (isPublicRoute(to)) {
    return;
  }

  // If Nova user is already resolved, allow
  const novaUser = useState("nova-user");
  if (novaUser.value) {
    return;
  }

  const { isSignedIn, isLoaded } = useAuth();

  // Clerk still loading -- don't redirect yet
  if (!isLoaded.value) {
    return;
  }

  // Signed in but NovaUser not resolved -- go to resolve
  if (isSignedIn.value) {
    return navigateTo("/auth/resolve");
  }

  // Not signed in
  return navigateTo("/landing");
});
