/**
 * Client-only plugin that restores the Nova user from localStorage
 * on app initialization. This ensures the global auth middleware
 * has access to the user state before any route navigation.
 */

export default defineNuxtPlugin(() => {
  const { restoreUser } = useNovaAuth();
  restoreUser();
});
