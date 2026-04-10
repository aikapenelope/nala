/**
 * Product cache composable.
 *
 * Provides cached product data from IndexedDB for instant UI responses.
 * Syncs with the server in the background when online.
 *
 * Pattern: online-first with aggressive cache.
 * 1. Show data from IndexedDB immediately (instant)
 * 2. Fetch fresh data from server in background
 * 3. Update IndexedDB with fresh data
 * 4. UI reactively updates when cache changes
 */

import type { CachedProduct } from "./useOfflineDb";

export function useProductCache() {
  const { db, isAvailable } = useOfflineDb();
  const products = ref<CachedProduct[]>([]);
  const isLoading = ref(false);
  const lastSyncAt = ref<string | null>(null);

  /**
   * Load products from IndexedDB cache.
   * Returns immediately with cached data.
   */
  async function loadFromCache() {
    if (!isAvailable || !db) return;

    try {
      products.value = await db.products.toArray();
      lastSyncAt.value =
        localStorage.getItem("nova:products:lastSync") ?? null;
    } catch (err) {
      console.error("Failed to load products from cache:", err);
    }
  }

  /**
   * Sync products from the server and update the local cache.
   * Called in the background after showing cached data.
   */
  async function syncFromServer() {
    if (!isAvailable || !db) return;

    isLoading.value = true;

    try {
      // TODO: Fetch products from API
      // const response = await $fetch('/api/products');
      // await db.products.bulkPut(response.products);
      // products.value = await db.products.toArray();

      const now = new Date().toISOString();
      localStorage.setItem("nova:products:lastSync", now);
      lastSyncAt.value = now;
    } catch (err) {
      console.error("Failed to sync products from server:", err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Search products in the local cache by name.
   * Works offline since it queries IndexedDB directly.
   */
  async function searchLocal(query: string): Promise<CachedProduct[]> {
    if (!isAvailable || !db || !query.trim()) return [];

    const lower = query.toLowerCase();
    return db.products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          (p.sku?.toLowerCase().includes(lower) ?? false),
      )
      .toArray();
  }

  /**
   * Get a single product from cache by ID.
   */
  async function getById(id: string): Promise<CachedProduct | undefined> {
    if (!isAvailable || !db) return undefined;
    return db.products.get(id);
  }

  /**
   * Initialize: load from cache, then sync in background.
   */
  async function init() {
    await loadFromCache();
    // Don't await -- sync happens in background
    syncFromServer();
  }

  return {
    products: readonly(products),
    isLoading: readonly(isLoading),
    lastSyncAt: readonly(lastSyncAt),
    init,
    loadFromCache,
    syncFromServer,
    searchLocal,
    getById,
  };
}
