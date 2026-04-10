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
 *
 * Connected to: POST /api/sales
 */

import type { PendingSale } from "./useOfflineDb";

export function useOfflineQueue() {
  const { db, isAvailable } = useOfflineDb();
  const { $api } = useApi();
  const pendingCount = ref(0);
  const isSyncing = ref(false);
  const isOnline = ref(true);
  const lastSyncError = ref<string | null>(null);

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
   * Stops on first server rejection to maintain order.
   */
  async function syncPendingSales() {
    if (!isAvailable || !db || isSyncing.value) return;

    isSyncing.value = true;
    lastSyncError.value = null;

    try {
      const pending = await db.pendingSales
        .where("synced")
        .equals(0)
        .sortBy("createdAt");

      for (const sale of pending) {
        try {
          // POST to /api/sales with the queued sale data
          await $api("/api/sales", {
            method: "POST",
            body: {
              items: sale.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.price,
                discountPercent: item.discount,
              })),
              payments: [
                {
                  method: sale.paymentMethod,
                  amountUsd: sale.total,
                },
              ],
              customerId: sale.customerId,
              discountPercent: 0,
            },
          });

          // Mark as synced on success
          await db.pendingSales.update(sale.id, { synced: true });
        } catch (err) {
          // If server rejects, record the error and stop syncing
          // (don't skip ahead -- maintain FIFO order)
          const fetchError = err as { data?: { error?: string } };
          lastSyncError.value =
            fetchError.data?.error ?? "Error sincronizando venta";
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
    lastSyncError: readonly(lastSyncError),
    init,
    queueSale,
    syncPendingSales,
    destroy,
  };
}
