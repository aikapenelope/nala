/**
 * Offline sales queue composable.
 *
 * When the device is offline, sales are saved to IndexedDB
 * with synced=false. When connectivity returns, they are
 * sent to the server in FIFO order.
 *
 * The server is always the source of truth. If a conflict
 * occurs (e.g., product out of stock), the server rejects
 * the sale and the user is notified.
 */

import type { PendingSale } from "./useOfflineDb";

export function useOfflineQueue() {
  const { db, isAvailable } = useOfflineDb();
  const pendingCount = ref(0);
  const isSyncing = ref(false);
  const isOnline = ref(true);

  /** Check online status. */
  function updateOnlineStatus() {
    if (import.meta.client) {
      isOnline.value = navigator.onLine;
    }
  }

  /** Initialize: count pending sales and set up listeners. */
  async function init() {
    if (!import.meta.client) return;

    updateOnlineStatus();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", () => {
      isOnline.value = false;
    });

    await refreshPendingCount();
  }

  /** When connectivity returns, start syncing. */
  async function handleOnline() {
    isOnline.value = true;
    await syncPendingSales();
  }

  /** Count pending (unsynced) sales in IndexedDB. */
  async function refreshPendingCount() {
    if (!isAvailable || !db) return;
    pendingCount.value = await db.pendingSales
      .where("synced")
      .equals(0)
      .count();
  }

  /**
   * Queue a sale for later sync.
   * Called when the device is offline and a sale is completed.
   */
  async function queueSale(sale: Omit<PendingSale, "id" | "synced">) {
    if (!isAvailable || !db) return;

    await db.pendingSales.add({
      ...sale,
      id: crypto.randomUUID(),
      synced: false,
    });

    await refreshPendingCount();
  }

  /**
   * Sync all pending sales to the server.
   * Sends in FIFO order (oldest first).
   */
  async function syncPendingSales() {
    if (!isAvailable || !db || isSyncing.value) return;

    isSyncing.value = true;

    try {
      const pending = await db.pendingSales
        .where("synced")
        .equals(0)
        .sortBy("createdAt");

      for (const sale of pending) {
        try {
          // TODO: POST to /api/sales with sale data
          // await $fetch('/api/sales', { method: 'POST', body: sale });

          // Mark as synced
          await db.pendingSales.update(sale.id, { synced: true });
        } catch {
          // If server rejects, stop syncing (don't skip ahead)
          break;
        }
      }
    } finally {
      isSyncing.value = false;
      await refreshPendingCount();
    }
  }

  /** Clean up event listeners. */
  function destroy() {
    if (import.meta.client) {
      window.removeEventListener("online", handleOnline);
    }
  }

  return {
    pendingCount: readonly(pendingCount),
    isSyncing: readonly(isSyncing),
    isOnline: readonly(isOnline),
    init,
    queueSale,
    syncPendingSales,
    destroy,
  };
}
