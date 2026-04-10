<script setup lang="ts">
/**
 * Inventory list page.
 *
 * Desktop: table with columns (name, SKU, stock, cost, price, margin, status).
 * Mobile: list with cards and semaphore indicator.
 *
 * Features:
 * - Search by name with autocompletado
 * - Filter by category and stock status
 * - Semaphore: green (OK), yellow (low), red (critical), gray (dead stock)
 */

import { calculateStockSemaphore } from "@nova/shared";
import type { StockSemaphore } from "@nova/shared";

const { isDesktop } = useDevice();
const { isAdmin } = useNovaAuth();

const searchQuery = ref("");
const selectedCategory = ref<string | null>(null);
const selectedStatus = ref<StockSemaphore | null>(null);

/** Mock products for UI development. Will be replaced by API calls. */
const products = ref([
  {
    id: "1",
    name: "Harina PAN 1kg",
    sku: "HP-001",
    stock: 5,
    stockMin: 10,
    stockCritical: 3,
    cost: 1.5,
    price: 2.0,
    category: "Abarrotes",
    lastSoldAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Aceite Diana 1L",
    sku: "AD-001",
    stock: 12,
    stockMin: 10,
    stockCritical: 3,
    cost: 3.0,
    price: 4.5,
    category: "Abarrotes",
    lastSoldAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Queso Blanco",
    sku: "QB-001",
    stock: 2,
    stockMin: 5,
    stockCritical: 2,
    cost: 2.0,
    price: 3.0,
    category: "Lácteos",
    lastSoldAt: new Date().toISOString(),
  },
  {
    id: "4",
    name: "Servilletas XL",
    sku: "SX-001",
    stock: 50,
    stockMin: 10,
    stockCritical: 3,
    cost: 0.5,
    price: 1.0,
    category: "Limpieza",
    lastSoldAt: "2026-01-15T00:00:00Z",
  },
]);

/** Get semaphore color for a product. */
function getSemaphore(p: (typeof products.value)[0]): StockSemaphore {
  return calculateStockSemaphore(
    p.stock,
    p.stockMin,
    p.stockCritical,
    p.lastSoldAt,
  );
}

/** Semaphore color CSS classes. */
const semaphoreColors: Record<StockSemaphore, string> = {
  green: "bg-stock-green",
  yellow: "bg-stock-yellow",
  red: "bg-stock-red",
  gray: "bg-stock-gray",
};

/** Semaphore labels. */
const semaphoreLabels: Record<StockSemaphore, string> = {
  green: "OK",
  yellow: "Bajo",
  red: "Crítico",
  gray: "Sin movimiento",
};

/** Calculate margin percentage. */
function margin(cost: number, price: number): string {
  if (price === 0) return "0";
  return (((price - cost) / price) * 100).toFixed(0);
}

/** Filtered products based on search and filters. */
const filteredProducts = computed(() => {
  return products.value.filter((p) => {
    if (
      searchQuery.value &&
      !p.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    ) {
      return false;
    }
    if (selectedCategory.value && p.category !== selectedCategory.value) {
      return false;
    }
    if (selectedStatus.value && getSemaphore(p) !== selectedStatus.value) {
      return false;
    }
    return true;
  });
});
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">Inventario</h1>
      <NuxtLink
        v-if="isAdmin"
        to="/inventory/new"
        class="rounded-lg bg-nova-primary px-4 py-2 text-sm font-medium text-white"
      >
        + Producto
      </NuxtLink>
    </div>

    <!-- Search and filters -->
    <div class="mb-4 flex gap-3">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Buscar producto..."
        class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
      />
      <select
        v-model="selectedStatus"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option :value="null">Todos</option>
        <option value="red">Crítico</option>
        <option value="yellow">Bajo</option>
        <option value="green">OK</option>
        <option value="gray">Sin movimiento</option>
      </select>
    </div>

    <!-- Desktop: Table view -->
    <div v-if="isDesktop" class="overflow-hidden rounded-xl bg-white shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-gray-200 bg-gray-50">
          <tr>
            <th class="px-4 py-3 font-medium text-gray-500">Estado</th>
            <th class="px-4 py-3 font-medium text-gray-500">Producto</th>
            <th class="px-4 py-3 font-medium text-gray-500">SKU</th>
            <th class="px-4 py-3 font-medium text-gray-500 text-right">Stock</th>
            <th v-if="isAdmin" class="px-4 py-3 font-medium text-gray-500 text-right">Costo</th>
            <th class="px-4 py-3 font-medium text-gray-500 text-right">Precio</th>
            <th v-if="isAdmin" class="px-4 py-3 font-medium text-gray-500 text-right">Margen</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="product in filteredProducts"
            :key="product.id"
            class="cursor-pointer hover:bg-gray-50"
          >
            <td class="px-4 py-3">
              <span
                class="inline-block h-3 w-3 rounded-full"
                :class="semaphoreColors[getSemaphore(product)]"
                :title="semaphoreLabels[getSemaphore(product)]"
              />
            </td>
            <td class="px-4 py-3 font-medium text-gray-900">
              {{ product.name }}
            </td>
            <td class="px-4 py-3 text-gray-500">{{ product.sku }}</td>
            <td class="px-4 py-3 text-right text-gray-900">
              {{ product.stock }}
            </td>
            <td v-if="isAdmin" class="px-4 py-3 text-right text-gray-500">
              ${{ product.cost.toFixed(2) }}
            </td>
            <td class="px-4 py-3 text-right text-gray-900">
              ${{ product.price.toFixed(2) }}
            </td>
            <td v-if="isAdmin" class="px-4 py-3 text-right text-gray-500">
              {{ margin(product.cost, product.price) }}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile: Card list -->
    <div v-else class="space-y-3">
      <NuxtLink
        v-for="product in filteredProducts"
        :key="product.id"
        :to="`/inventory/${product.id}`"
        class="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm"
      >
        <!-- Semaphore dot -->
        <span
          class="h-3 w-3 flex-shrink-0 rounded-full"
          :class="semaphoreColors[getSemaphore(product)]"
        />

        <!-- Product info -->
        <div class="flex-1 min-w-0">
          <p class="truncate font-medium text-gray-900">{{ product.name }}</p>
          <p class="text-xs text-gray-500">{{ product.stock }} en stock</p>
        </div>

        <!-- Price -->
        <div class="text-right">
          <p class="font-medium text-gray-900">${{ product.price.toFixed(2) }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
