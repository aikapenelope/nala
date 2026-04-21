/**
 * Client-only plugin that restores auth state on app initialization.
 *
 * Runs before any route navigation to ensure the NovaUser is
 * restored from localStorage (for the global middleware).
 */

export default defineNuxtPlugin(() => {
  const { restoreUser } = useNovaAuth();

  // Restore the active user (owner or employee)
  restoreUser();
});
