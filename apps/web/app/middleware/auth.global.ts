/**
 * Global authentication middleware.
 *
 * Protects all routes by default. Unauthenticated users are
 * redirected to /landing unless they are visiting a public route.
 *
 * Public routes (no auth required):
 * - /landing
 * - /auth/login
 * - /auth/pin
 * - /auth/resolve (post-Clerk-login user resolution)
 * - /onboarding
 *
 * Special handling:
 * - If Clerk is signed in but NovaUser is not set, redirect to
 *   /auth/resolve which calls /api/me to look up the Nova account.
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
  const { isAuthenticated } = useNovaAuth();

  const isPublic = PUBLIC_ROUTES.some(
    (route) => to.path === route || to.path.startsWith(route + "/"),
  );

  // Allow public routes without auth
  if (isPublic) {
    return;
  }

  // If NovaUser is set, allow navigation
  if (isAuthenticated.value) {
    return;
  }

  // Check if Clerk has an active session (owner signed in via Clerk
  // but NovaUser not yet resolved from the backend).
  // useAuth() is provided by @clerk/nuxt.
  if (import.meta.client) {
    try {
      const { isSignedIn } = useAuth();
      if (isSignedIn.value) {
        // Clerk is signed in but NovaUser is not set.
        // Redirect to the resolver page which will call /api/me.
        return navigateTo("/auth/resolve");
      }
    } catch {
      // Clerk not initialized -- fall through to landing redirect
    }
  }

  // No auth at all -- redirect to landing
  return navigateTo("/landing");
});
