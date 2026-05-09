/**
 * Orders badge composable.
 *
 * Provides the count of pending orders for display in
 * sidebar and bottom tabs badges. Fetches on mount and
 * can be refreshed manually.
 *
 * Usage:
 *   const { pendingCount, refresh } = useOrdersBadge();
 */

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

  // Fetch on first use (client-side only)
  if (import.meta.client) {
    const fetched = useState<boolean>("orders-badge-fetched", () => false);
    if (!fetched.value) {
      fetched.value = true;
      refresh();
    }
  }

  return {
    pendingCount: readonly(pendingCount),
    refresh,
  };
}
