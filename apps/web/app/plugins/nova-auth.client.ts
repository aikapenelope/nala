/**
 * Client-only plugin that restores auth state on app initialization.
 *
 * Runs before any route navigation to ensure:
 * 1. Device mode is initialized (owner vs store)
 * 2. NovaUser is restored from localStorage (for the global middleware)
 * 3. Team roster is loaded from localStorage cache (for local PIN verification)
 * 4. Auto-refresh of the roster is started (every 1 minute)
 */

export default defineNuxtPlugin(() => {
  const { init: initDeviceMode } = useDeviceMode();
  const { restoreUser } = useNovaAuth();
  const { loadFromCache, startAutoRefresh } = useTeamRoster();

  // Initialize device mode (owner or store)
  initDeviceMode();

  // Restore the active user (owner or employee)
  restoreUser();

  // Load the team roster from cache for local PIN verification
  loadFromCache();

  // Start periodic roster refresh (picks up employee changes)
  startAutoRefresh();
});
