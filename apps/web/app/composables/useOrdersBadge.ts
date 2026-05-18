/**
 * Orders badge composable with global polling.
 *
 * Provides the count of pending orders for display in
 * sidebar and bottom tabs badges. Polls every 30 seconds
 * so the badge updates in real-time regardless of which
 * page the user is on.
 *
 * Polling is shared across all components that use this composable
 * (singleton via useState). Only one interval runs at a time.
 *
 * Usage:
 *   const { pendingCount, refresh } = useOrdersBadge();
 */

/** Polling interval in milliseconds. */
const POLL_INTERVAL = 30_000;

export function useOrdersBadge() {
  const { $api } = useApi();

  const pendingCount = useState<number>("orders-pending-count", () => 0);

  /** Fetch pending count from the API. */
  async function refresh() {
    try {
      const result = await $api<{
        orders: unknown[];
        pendingCount: number;
      }>("/api/orders?status=pending&limit=1");
      pendingCount.value = result.pendingCount;
    } catch {
      // Silently fail — badge is non-critical
    }
  }

  // Start polling on first use (client-side only, singleton)
  if (import.meta.client) {
    const initialized = useState<boolean>("orders-badge-initialized", () => false);
    if (!initialized.value) {
      initialized.value = true;
      refresh();

      // Global polling: updates badge every 30s regardless of current page
      const interval = setInterval(refresh, POLL_INTERVAL);

      // Clean up if the app is destroyed (SPA navigation won't trigger this,
      // but full page unload will)
      if (typeof window !== "undefined") {
        window.addEventListener("beforeunload", () => clearInterval(interval));
      }
    }
  }

  return {
    pendingCount: readonly(pendingCount),
    refresh,
  };
}
