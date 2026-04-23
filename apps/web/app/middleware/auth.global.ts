/**
 * Global authentication middleware.
 *
 * Uses Clerk's recommended pattern for Nuxt page protection.
 * See: https://clerk.com/docs/guides/secure/protect-pages
 *
 * Flow:
 * 1. Public routes always pass through.
 * 2. If NovaUser is already resolved, allow access.
 * 3. If Clerk is still loading, allow access (avoid premature redirects).
 * 4. If Clerk is loaded and user is signed in but NovaUser not resolved,
 *    redirect to /auth/resolve.
 * 5. If Clerk is loaded and user is NOT signed in, redirect to /landing.
 */

/** Matcher for public routes that don't require authentication. */
const isPublicRoute = createRouteMatcher([
  "/landing",
  "/auth/login",
  "/auth/signup",
  "/auth/resolve",
  "/onboarding(.*)",
  "/catalogo(.*)",
]);

export default defineNuxtRouteMiddleware((to) => {
  // Public routes -- always allow
  if (isPublicRoute(to)) {
    return;
  }

  // If Nova user is already resolved, allow access
  const { isAuthenticated } = useNovaAuth();
  if (isAuthenticated.value) {
    return;
  }

  // Check Clerk auth state
  const { isSignedIn, isLoaded } = useAuth();

  // If Clerk hasn't loaded yet, don't redirect -- let the page render.
  // The resolve page or component-level guards will handle it once loaded.
  if (!isLoaded.value) {
    return;
  }

  // Clerk is loaded and user is signed in but NovaUser not resolved
  if (isSignedIn.value) {
    return navigateTo("/auth/resolve");
  }

  // Clerk is loaded and user is NOT signed in
  return navigateTo("/landing");
});
