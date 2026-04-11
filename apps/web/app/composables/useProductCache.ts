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
 *
 * Connected to: GET /api/products
 */

import type { CachedProduct } from "./useOfflineDb";

export function useProductCache() {
  const { db, isAvailable } = useOfflineDb();
  const { $api } = useApi();
  const products = ref<CachedProduct[]>([]);
  const isLoading = ref(false);
  const lastSyncAt = ref<string | null>(null);
  const syncError = ref<string | null>(null);

  /**
   * Load products from IndexedDB cache.
   * Returns immediately with cached data.
   */
  async function loadFromCache() {
    if (!isAvailable || !db) return;

    try {
      products.value = await db.products.toArray();
      lastSyncAt.value = localStorage.getItem("nova:products:lastSync") ?? null;
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
    syncError.value = null;

    try {
      // Fetch all active products from API (up to 1000 for cache)
      const response = await $api<{
        products: Array<{
          id: string;
          name: string;
          sku: string | null;
          categoryId: string | null;
          price: string;
          stock: number;
          updatedAt: string;
        }>;
      }>("/api/products?limit=1000");

      // Map API response to CachedProduct format
      const cached: CachedProduct[] = response.products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku ?? undefined,
        categoryId: p.categoryId ?? undefined,
        price: Number(p.price),
        stock: p.stock,
        updatedAt: p.updatedAt,
      }));

      // Replace all cached products with fresh data
      await db.transaction("rw", db.products, async () => {
        await db.products.clear();
        await db.products.bulkPut(cached);
      });

      products.value = cached;

      const now = new Date().toISOString();
      localStorage.setItem("nova:products:lastSync", now);
      lastSyncAt.value = now;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      syncError.value = message;
      console.error("Failed to sync products from server:", message);
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
    syncError: readonly(syncError),
    init,
    loadFromCache,
    syncFromServer,
    searchLocal,
    getById,
  };
}
