/**
 * Global authentication middleware.
 *
 * Uses Clerk's recommended pattern for Nuxt page protection.
 * See: https://clerk.com/docs/guides/secure/protect-pages
 *
 * Public routes are accessible without authentication.
 * All other routes require the user to be signed in via Clerk.
 * If signed in but NovaUser not resolved, redirect to /auth/resolve.
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

  // Check if Nova user is resolved (app-level auth)
  const { isAuthenticated } = useNovaAuth();
  if (isAuthenticated.value) {
    return;
  }

  // Check if Clerk user is signed in (Clerk-level auth)
  const { isSignedIn } = useAuth();
  if (isSignedIn.value) {
    // Signed in with Clerk but NovaUser not resolved yet
    return navigateTo("/auth/resolve");
  }

  // Not signed in at all
  return navigateTo("/landing");
});
