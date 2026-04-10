<script setup lang="ts">
/**
 * Inventory list page.
 *
 * Desktop: table with columns (name, SKU, stock, cost, price, margin, status).
 * Mobile: list with cards and semaphore indicator.
 *
 * Connected to: GET /api/products?search=&status=&page=&limit=
 */

import type { StockSemaphore } from "@nova/shared";

const { isDesktop } = useDevice();
const { isAdmin } = useNovaAuth();
const { $api } = useApi();

const searchQuery = ref("");
const selectedStatus = ref<StockSemaphore | null>(null);
const isLoading = ref(true);
const loadError = ref("");

/** Product type from API response. */
interface Product {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  stockMin: number;
  stockCritical: number;
  cost: string;
  price: string;
  categoryId: string | null;
  lastSoldAt: string | null;
  semaphore: StockSemaphore;
}

const products = ref<Product[]>([]);
const totalProducts = ref(0);
const page = ref(1);
const limit = 50;

/** Debounce timer for search. */
let searchTimer: ReturnType<typeof setTimeout> | null = null;

/** Fetch products from API. */
async function fetchProducts() {
  isLoading.value = true;
  loadError.value = "";

  try {
    const params = new URLSearchParams();
    if (searchQuery.value) params.set("search", searchQuery.value);
    if (selectedStatus.value) params.set("status", selectedStatus.value);
    params.set("page", String(page.value));
    params.set("limit", String(limit));

    const result = await $api<{
      products: Product[];
      total: number;
      page: number;
      limit: number;
    }>(`/api/products?${params.toString()}`);

    products.value = result.products;
    totalProducts.value = result.total;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando inventario";
    loadError.value = message;
  } finally {
    isLoading.value = false;
  }
}

/** Debounced search. */
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    fetchProducts();
  }, 300);
}

/** Filter change triggers immediate fetch. */
function onStatusChange() {
  page.value = 1;
  fetchProducts();
}

watch(selectedStatus, onStatusChange);

onMounted(() => {
  fetchProducts();
});

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
  red: "Critico",
  gray: "Sin movimiento",
};

/** Calculate margin percentage. */
function margin(cost: string, price: string): string {
  const c = Number(cost);
  const p = Number(price);
  if (p === 0) return "0";
  return (((p - c) / p) * 100).toFixed(0);
}
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
        @input="onSearchInput"
      />
      <select
        v-model="selectedStatus"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option :value="null">Todos</option>
        <option value="red">Critico</option>
        <option value="yellow">Bajo</option>
        <option value="green">OK</option>
        <option value="gray">Sin movimiento</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando inventario...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
      <button
        class="mt-2 block w-full text-xs font-medium text-red-700 underline"
        @click="fetchProducts"
      >
        Reintentar
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="products.length === 0"
      class="py-12 text-center text-gray-400"
    >
      <p>No hay productos{{ searchQuery ? " que coincidan" : "" }}</p>
      <NuxtLink
        v-if="isAdmin && !searchQuery"
        to="/inventory/new"
        class="mt-2 inline-block text-sm text-nova-primary hover:underline"
      >
        Crear primer producto
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Desktop: Table view -->
      <div
        v-if="isDesktop"
        class="overflow-hidden rounded-xl bg-white shadow-sm"
      >
        <table class="w-full text-left text-sm">
          <thead class="border-b border-gray-200 bg-gray-50">
            <tr>
              <th class="px-4 py-3 font-medium text-gray-500">Estado</th>
              <th class="px-4 py-3 font-medium text-gray-500">Producto</th>
              <th class="px-4 py-3 font-medium text-gray-500">SKU</th>
              <th class="px-4 py-3 text-right font-medium text-gray-500">
                Stock
              </th>
              <th
                v-if="isAdmin"
                class="px-4 py-3 text-right font-medium text-gray-500"
              >
                Costo
              </th>
              <th class="px-4 py-3 text-right font-medium text-gray-500">
                Precio
              </th>
              <th
                v-if="isAdmin"
                class="px-4 py-3 text-right font-medium text-gray-500"
              >
                Margen
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="product in products"
              :key="product.id"
              class="cursor-pointer hover:bg-gray-50"
              @click="navigateTo(`/inventory/${product.id}`)"
            >
              <td class="px-4 py-3">
                <span
                  class="inline-block h-3 w-3 rounded-full"
                  :class="semaphoreColors[product.semaphore]"
                  :title="semaphoreLabels[product.semaphore]"
                />
              </td>
              <td class="px-4 py-3 font-medium text-gray-900">
                {{ product.name }}
              </td>
              <td class="px-4 py-3 text-gray-500">{{ product.sku ?? "-" }}</td>
              <td class="px-4 py-3 text-right text-gray-900">
                {{ product.stock }}
              </td>
              <td v-if="isAdmin" class="px-4 py-3 text-right text-gray-500">
                ${{ Number(product.cost).toFixed(2) }}
              </td>
              <td class="px-4 py-3 text-right text-gray-900">
                ${{ Number(product.price).toFixed(2) }}
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
          v-for="product in products"
          :key="product.id"
          :to="`/inventory/${product.id}`"
          class="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm"
        >
          <span
            class="h-3 w-3 flex-shrink-0 rounded-full"
            :class="semaphoreColors[product.semaphore]"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-gray-900">
              {{ product.name }}
            </p>
            <p class="text-xs text-gray-500">{{ product.stock }} en stock</p>
          </div>
          <div class="text-right">
            <p class="font-medium text-gray-900">
              ${{ Number(product.price).toFixed(2) }}
            </p>
          </div>
        </NuxtLink>
      </div>

      <!-- Pagination info -->
      <p
        v-if="totalProducts > limit"
        class="mt-4 text-center text-xs text-gray-400"
      >
        Mostrando {{ products.length }} de {{ totalProducts }} productos
      </p>
    </template>
  </div>
</template>
