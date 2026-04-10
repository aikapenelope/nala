/**
 * IndexedDB cache layer using Dexie.js.
 *
 * Provides local cache for products, customers, and sales
 * to enable instant UI responses and offline operation.
 * The server (PostgreSQL) is always the source of truth.
 */

import Dexie from "dexie";
import type { Table } from "dexie";

/** Cached product for local search and offline sales. */
export interface CachedProduct {
  id: string;
  name: string;
  sku?: string;
  categoryId?: string;
  price: number;
  stock: number;
  updatedAt: string;
}

/** Cached customer for quick lookup. */
export interface CachedCustomer {
  id: string;
  name: string;
  phone?: string;
  balance: number;
  updatedAt: string;
}

/** Offline sale queued for sync when internet returns. */
export interface PendingSale {
  id: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    discount: number;
  }>;
  total: number;
  paymentMethod: string;
  customerId?: string;
  userId: string;
  createdAt: string;
  synced: boolean;
}

/** Dexie database definition for Nova's local cache. */
class NovaLocalDb extends Dexie {
  products!: Table<CachedProduct, string>;
  customers!: Table<CachedCustomer, string>;
  pendingSales!: Table<PendingSale, string>;

  constructor() {
    super("NovaDB");

    this.version(1).stores({
      products: "id, name, sku, categoryId",
      customers: "id, name, phone",
      pendingSales: "id, synced, createdAt",
    });
  }
}

/** Singleton database instance. Only created on the client. */
let db: NovaLocalDb | null = null;

/**
 * Composable to access the local IndexedDB cache.
 * Returns null on the server (SSR) since IndexedDB is browser-only.
 */
export function useOfflineDb() {
  if (import.meta.server) {
    return { db: null, isAvailable: false };
  }

  if (!db) {
    db = new NovaLocalDb();
  }

  return { db, isAvailable: true };
}
