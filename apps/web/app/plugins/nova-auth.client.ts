/**
 * Client-only plugin that restores auth state on app initialization.
 *
 * Runs before any route navigation to ensure:
 * 1. NovaUser is restored from localStorage (for the global middleware)
 * 2. Team roster is loaded from localStorage cache (for local PIN verification)
 * 3. Auto-refresh of the roster is started (every 5 minutes)
 */

export default defineNuxtPlugin(() => {
  const { restoreUser } = useNovaAuth();
  const { loadFromCache, startAutoRefresh } = useTeamRoster();

  // Restore the active user (owner or employee)
  restoreUser();

  // Load the team roster from cache for local PIN verification
  loadFromCache();

  // Start periodic roster refresh (picks up employee changes)
  startAutoRefresh();
});
