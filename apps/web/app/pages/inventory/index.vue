<script setup lang="ts">
/**
 * Inventory list page.
 *
 * Two view modes (toggle in header):
 * - List: table (desktop) or cards (mobile) with thumbnails.
 * - Grid: product cards with large images, name, price, stock, semaphore.
 *
 * Connected to: GET /api/products?search=&status=&page=&limit=
 */

import type { StockSemaphore } from "@nova/shared";
import {
  Search,
  Upload,
  Plus,
  Camera,
  List,
  LayoutGrid,
} from "lucide-vue-next";

const { isDesktop } = useDevice();

const { $api, apiBase } = useApi();

/** Resolve image URL: prepend API base for relative paths from the API. */
function resolveImageUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `${apiBase}${url}`;
}

const searchQuery = ref("");
const selectedStatus = ref<StockSemaphore | null>(null);
const isLoading = ref(true);
const loadError = ref("");

/** View mode: list (default) or grid. */
const viewMode = ref<"list" | "grid">("list");

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
  imageUrl: string | null;
  semaphore: StockSemaphore;
  daysUntilDepletion: number | null;
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

/** Semaphore badge styles. */
const semaphoreBadge: Record<StockSemaphore, string> = {
  green: "bg-green-50 text-green-700",
  yellow: "bg-yellow-50 text-yellow-700",
  red: "bg-red-50 text-red-700",
  gray: "bg-gray-100 text-gray-500",
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
    <SharedContextualTip
      tip-id="inventory"
      title="Tu inventario"
      description="Aqui ves todos tus productos con semaforo de stock (verde, amarillo, rojo). Usa los filtros para buscar por nombre, categoria o estado. Toca un producto para editarlo."
    />

    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-extrabold tracking-tight text-gradient">
        Inventario
      </h1>
      <div class="flex gap-2">
        <!-- View mode toggle -->
        <div class="glass flex rounded-2xl p-0.5">
          <button
            class="flex items-center justify-center rounded-xl px-2.5 py-1.5 transition-spring"
            :class="
              viewMode === 'list'
                ? 'bg-white shadow-sm text-gray-800'
                : 'text-gray-400 hover:text-gray-600'
            "
            title="Vista lista"
            @click="viewMode = 'list'"
          >
            <List :size="16" />
          </button>
          <button
            class="flex items-center justify-center rounded-xl px-2.5 py-1.5 transition-spring"
            :class="
              viewMode === 'grid'
                ? 'bg-white shadow-sm text-gray-800'
                : 'text-gray-400 hover:text-gray-600'
            "
            title="Vista cuadricula"
            @click="viewMode = 'grid'"
          >
            <LayoutGrid :size="16" />
          </button>
        </div>
        <NuxtLink
          to="/inventory/import-photo"
          class="glass flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-bold text-gray-700 transition-spring hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08)]"
        >
          <Camera :size="14" />
          Foto
        </NuxtLink>
        <NuxtLink
          to="/inventory/import"
          class="glass flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-bold text-gray-700 transition-spring hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08)]"
        >
          <Upload :size="14" />
          Excel
        </NuxtLink>
        <NuxtLink
          to="/inventory/new"
          class="dark-pill flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-bold transition-spring"
        >
          <Plus :size="14" />
          Producto
        </NuxtLink>
      </div>
    </div>

    <!-- Search and filters -->
    <div class="mb-4 flex gap-3">
      <div
        class="glass relative flex flex-1 items-center rounded-2xl px-4 py-2.5"
      >
        <Search :size="16" class="mr-2 flex-shrink-0 text-gray-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar producto..."
          class="w-full bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
          @input="onSearchInput"
        />
      </div>
      <select
        v-model="selectedStatus"
        class="glass rounded-2xl border-0 px-4 py-2.5 text-sm font-bold text-gray-700 outline-none"
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
      <div
        class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary"
      />
      Cargando inventario...
    </div>

    <!-- Error -->
    <div v-else-if="loadError" class="card-premium p-6 text-center">
      <p class="text-sm font-semibold text-red-500">{{ loadError }}</p>
      <button
        class="mt-3 text-xs font-bold text-nova-primary underline"
        @click="fetchProducts"
      >
        Reintentar
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="products.length === 0"
      class="card-premium py-12 text-center"
    >
      <p class="text-sm font-medium text-gray-400">
        No hay productos{{ searchQuery ? " que coincidan" : "" }}
      </p>
      <NuxtLink
        v-if="!searchQuery"
        to="/inventory/new"
        class="mt-3 inline-block text-sm font-bold text-nova-primary hover:underline"
      >
        Crear primer producto
      </NuxtLink>
    </div>

    <template v-else>
      <!-- ============================================================ -->
      <!-- LIST VIEW -->
      <!-- ============================================================ -->
      <template v-if="viewMode === 'list'">
        <!-- Desktop: Table view -->
        <div v-if="isDesktop" class="card-premium overflow-hidden">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-white/50">
              <tr>
                <th
                  class="px-4 py-3.5 text-[11px] font-bold tracking-wider text-gray-400 uppercase"
                >
                  Estado
                </th>
                <th
                  class="px-4 py-3.5 text-[11px] font-bold tracking-wider text-gray-400 uppercase"
                >
                  Producto
                </th>
                <th
                  class="px-4 py-3.5 text-[11px] font-bold tracking-wider text-gray-400 uppercase"
                >
                  SKU
                </th>
                <th
                  class="px-4 py-3.5 text-right text-[11px] font-bold tracking-wider text-gray-400 uppercase"
                >
                  Stock
                </th>
                <th
                  class="px-4 py-3.5 text-right text-[11px] font-bold tracking-wider text-gray-400 uppercase"
                >
                  Duracion
                </th>
                <th
                  class="px-4 py-3.5 text-right text-[11px] font-bold tracking-wider text-gray-400 uppercase"
                >
                  Costo
                </th>
                <th
                  class="px-4 py-3.5 text-right text-[11px] font-bold tracking-wider text-gray-400 uppercase"
                >
                  Precio
                </th>
                <th
                  class="px-4 py-3.5 text-right text-[11px] font-bold tracking-wider text-gray-400 uppercase"
                >
                  Margen
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/30">
              <tr
                v-for="product in products"
                :key="product.id"
                class="cursor-pointer transition-spring hover:bg-white/60"
                @click="navigateTo(`/inventory/${product.id}`)"
              >
                <td class="px-4 py-3.5">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                    :class="semaphoreBadge[product.semaphore]"
                  >
                    <span
                      class="mr-1.5 h-1.5 w-1.5 rounded-full"
                      :class="semaphoreColors[product.semaphore]"
                    />
                    {{ semaphoreLabels[product.semaphore] }}
                  </span>
                </td>
                <td class="px-4 py-3.5">
                  <div class="flex items-center gap-3">
                    <img
                      v-if="product.imageUrl"
                      :src="resolveImageUrl(product.imageUrl)"
                      :alt="product.name"
                      class="h-9 w-9 flex-shrink-0 rounded-lg object-cover"
                    />
                    <div
                      v-else
                      class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#EFECFF] to-[#D0CCF9] text-xs font-extrabold text-nova-accent"
                    >
                      {{ product.name.charAt(0) }}
                    </div>
                    <span class="font-semibold text-gray-800">{{
                      product.name
                    }}</span>
                  </div>
                </td>
                <td class="px-4 py-3.5 text-gray-500">
                  {{ product.sku ?? "-" }}
                </td>
                <td class="px-4 py-3.5 text-right font-semibold text-gray-800">
                  {{ product.stock }}
                </td>
                <td class="px-4 py-3.5 text-right text-xs text-gray-500">
                  <template v-if="product.daysUntilDepletion === 0">
                    <span class="font-bold text-red-600">Agotado</span>
                  </template>
                  <template v-else-if="product.daysUntilDepletion !== null">
                    ~{{ product.daysUntilDepletion }}d
                  </template>
                  <template v-else>-</template>
                </td>
                <td class="px-4 py-3.5 text-right text-gray-500">
                  ${{ Number(product.cost).toFixed(2) }}
                </td>
                <td class="px-4 py-3.5 text-right font-semibold text-gray-800">
                  ${{ Number(product.price).toFixed(2) }}
                </td>
                <td class="px-4 py-3.5 text-right">
                  <span
                    class="rounded-lg px-1.5 py-0.5 text-xs font-bold"
                    :class="
                      Number(margin(product.cost, product.price)) >= 30
                        ? 'bg-green-50 text-green-700'
                        : Number(margin(product.cost, product.price)) >= 15
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-red-50 text-red-600'
                    "
                  >
                    {{ margin(product.cost, product.price) }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile: Card list -->
        <div v-else class="space-y-2.5">
          <NuxtLink
            v-for="product in products"
            :key="product.id"
            :to="`/inventory/${product.id}`"
            class="card-premium card-lift flex items-center gap-3 p-4"
          >
            <!-- Thumbnail with semaphore indicator -->
            <div class="relative flex-shrink-0">
              <img
                v-if="product.imageUrl"
                :src="resolveImageUrl(product.imageUrl)"
                :alt="product.name"
                class="h-11 w-11 rounded-xl object-cover"
              />
              <div
                v-else
                class="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#EFECFF] to-[#D0CCF9] text-sm font-extrabold text-nova-accent"
              >
                {{ product.name.charAt(0) }}
              </div>
              <span
                class="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white shadow-sm"
                :class="semaphoreColors[product.semaphore]"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-gray-800">
                {{ product.name }}
              </p>
              <p class="text-xs font-medium text-gray-500">
                {{ product.stock }} en stock
                <template
                  v-if="
                    product.daysUntilDepletion !== null &&
                    product.daysUntilDepletion > 0
                  "
                >
                  · ~{{ product.daysUntilDepletion }}d
                </template>
                <template v-else-if="product.daysUntilDepletion === 0">
                  · <span class="font-bold text-red-600">Agotado</span>
                </template>
              </p>
            </div>
            <div class="text-right">
              <p class="font-bold text-gray-800">
                ${{ Number(product.price).toFixed(2) }}
              </p>
              <span
                class="text-[10px] font-bold"
                :class="
                  Number(margin(product.cost, product.price)) >= 30
                    ? 'text-green-600'
                    : Number(margin(product.cost, product.price)) >= 15
                      ? 'text-yellow-600'
                      : 'text-red-600'
                "
              >
                {{ margin(product.cost, product.price) }}%
              </span>
            </div>
          </NuxtLink>
        </div>
      </template>

      <!-- ============================================================ -->
      <!-- GRID VIEW -->
      <!-- ============================================================ -->
      <div
        v-else
        class="grid gap-3"
        :class="
          isDesktop
            ? 'grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
            : 'grid-cols-2 sm:grid-cols-3'
        "
      >
        <NuxtLink
          v-for="product in products"
          :key="product.id"
          :to="`/inventory/${product.id}`"
          class="card-premium card-lift flex flex-col overflow-hidden"
        >
          <!-- Image area -->
          <div class="relative aspect-square w-full bg-gray-50">
            <img
              v-if="product.imageUrl"
              :src="resolveImageUrl(product.imageUrl)"
              :alt="product.name"
              class="h-full w-full object-cover"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#EFECFF] to-[#D0CCF9]"
            >
              <span class="text-3xl font-extrabold text-nova-accent/60">
                {{ product.name.charAt(0) }}
              </span>
            </div>
            <!-- Semaphore badge -->
            <span
              class="absolute left-2 top-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold backdrop-blur-sm"
              :class="semaphoreBadge[product.semaphore]"
            >
              <span
                class="mr-1 h-1.5 w-1.5 rounded-full"
                :class="semaphoreColors[product.semaphore]"
              />
              {{ semaphoreLabels[product.semaphore] }}
            </span>
            <!-- Stock count -->
            <span
              class="absolute bottom-2 right-2 rounded-lg bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm"
            >
              {{ product.stock }} uds
            </span>
          </div>
          <!-- Info -->
          <div class="p-3">
            <p class="truncate text-[13px] font-semibold text-gray-800">
              {{ product.name }}
            </p>
            <div class="mt-1 flex items-center justify-between">
              <span class="text-sm font-bold text-nova-primary">
                ${{ Number(product.price).toFixed(2) }}
              </span>
              <span
                class="text-[10px] font-bold"
                :class="
                  Number(margin(product.cost, product.price)) >= 30
                    ? 'text-green-600'
                    : Number(margin(product.cost, product.price)) >= 15
                      ? 'text-yellow-600'
                      : 'text-red-600'
                "
              >
                {{ margin(product.cost, product.price) }}%
              </span>
            </div>
          </div>
        </NuxtLink>
      </div>

      <!-- Pagination info -->
      <p
        v-if="totalProducts > limit"
        class="mt-4 text-center text-xs font-medium text-gray-400"
      >
        Mostrando {{ products.length }} de {{ totalProducts }} productos
      </p>
    </template>
  </div>
</template>
