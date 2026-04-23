/**
 * Global authentication middleware.
 *
 * Simple auth flow using Clerk Organizations:
 *   1. NovaUser in state?        -> allow
 *   2. Route is public?          -> allow
 *   3. Clerk signed in?          -> redirect to /auth/resolve
 *   4. Nothing                   -> redirect to /landing
 */

/** Routes accessible without authentication. */
const PUBLIC_ROUTES = [
  "/landing",
  "/auth/login",
  "/auth/signup",
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

  // 3. Clerk signed in but NovaUser not resolved yet
  try {
    const { isSignedIn } = useAuth();
    if (isSignedIn.value) {
      return navigateTo("/auth/resolve");
    }
  } catch {
    // Clerk not initialized -- continue to next check
  }

  // 4. No auth at all -- show landing
  return navigateTo("/landing");
});
