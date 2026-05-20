<script setup lang="ts">
/**
 * Storefront catalog page — universal product grid.
 *
 * Single layout for all business types: visual cards with carousel,
 * cart checkout, 2-column grid. Following Treinta.co's model:
 * one product, one UI, for everyone.
 *
 * Uses SSR data fetching via useStorefrontData() — the catalog is fetched
 * on the server and sent with the HTML, eliminating the client-side waterfall.
 */

import { currentDayOfWeekVET } from "@nova/shared";
import {
  Search,
  LayoutGrid,
  Info,
  ShoppingBag,
} from "lucide-vue-next";

definePageMeta({ layout: "storefront" });

const runtimeConfig = useRuntimeConfig();
const storefrontApiBase = runtimeConfig.public.apiBase as string;

// SSR-compatible data fetching — runs on server, hydrates on client
const {
  business,
  products,
  categories,
  storeInfo,
  exchangeRate,
  isLoading,
  hasMore,
  error,
  refresh: fetchCatalog,
} = useStorefrontData();

// Client-side pagination for infinite scroll
const { isLoadingMore, fetchMore } = useStorefrontPagination();

const { addItem } = useCart();
const { config: sfConfig } = useStorefrontConfig();

/** Resolve image URL: prepend API base for relative paths from the catalog API. */
function resolveImageUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `${storefrontApiBase}${url}`;
}

useStorefrontSeo({ title: "Catalogo" });

const selectedCategory = ref<string | null>(null);
const searchQuery = ref("");
const addedProductId = ref<string | null>(null);

/** Day keys matching JS getDay() (0=Sun, 1=Mon, ..., 6=Sat). */
const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Compute today's open/close status from storeInfo.businessHours. */
const todayHours = computed(() => {
  const hours = storeInfo.value?.businessHours;
  if (!hours) return null;
  const dayIdx = currentDayOfWeekVET();
  const key = dayKeys[dayIdx] as keyof typeof hours;
  if (!key) return null;
  const day = hours[key];
  if (!day) return { open: false, label: "Cerrado hoy" };
  return { open: true, label: `Hoy: ${day.open} - ${day.close}` };
});

/** Payment method labels for display. */
const paymentLabels = computed(() => {
  const methods = storeInfo.value?.paymentMethods;
  if (!methods || methods.length === 0) return null;
  return methods.map((m) => m.label).join(", ");
});

/** Filtered products: by category and search query. */
const filteredProducts = computed(() => {
  let result = products.value;

  if (selectedCategory.value) {
    result = result.filter(
      (p) => p.categoryName === selectedCategory.value,
    );
  }

  const query = searchQuery.value.trim().toLowerCase();
  if (query.length >= 2) {
    result = result.filter((p) =>
      p.name.toLowerCase().includes(query),
    );
  }

  return result;
});

/**
 * Add to cart with haptic feedback.
 */
function handleAddToCart(product: (typeof products.value)[number]) {
  addItem({
    id: product.id,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
  });
  addedProductId.value = product.id;

  if (import.meta.client && navigator.vibrate) {
    navigator.vibrate(50);
  }

  setTimeout(() => {
    addedProductId.value = null;
  }, 1200);
}

// Note: data fetching is handled by useStorefrontData() via useAsyncData.
// No onMounted fetch needed — SSR delivers data with the HTML payload.

/** Infinite scroll sentinel. */
const scrollSentinel = ref<HTMLElement | null>(null);

onMounted(() => {
  if (!import.meta.client) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting && hasMore.value && !isLoadingMore.value) {
        fetchMore();
      }
    },
    { rootMargin: "200px" },
  );

  watch(
    scrollSentinel,
    (el) => {
      observer.disconnect();
      if (el) observer.observe(el);
    },
    { immediate: true },
  );

  onUnmounted(() => observer.disconnect());
});
</script>

<template>
  <div>
    <!-- ============================================================ -->
    <!-- LOADING SKELETON -->
    <!-- ============================================================ -->
    <div v-if="isLoading" class="px-5 pt-5">
      <div class="mb-4">
        <div class="h-12 flex-1 rounded-2xl bg-gray-100 animate-pulse dark:bg-white/5" />
      </div>
      <div class="mb-5 flex gap-2.5">
        <div v-for="n in 4" :key="n" class="h-10 w-20 rounded-full bg-gray-100 animate-pulse dark:bg-white/5" />
      </div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-7">
        <div v-for="n in 6" :key="n" class="flex flex-col">
          <div class="aspect-[4/5] rounded-[24px] bg-gray-100 animate-pulse mb-3 dark:bg-white/5" />
          <div class="space-y-2 px-1">
            <div class="h-3 w-16 rounded bg-gray-100 animate-pulse dark:bg-white/5" />
            <div class="h-4 w-28 rounded bg-gray-100 animate-pulse dark:bg-white/5" />
            <div class="h-5 w-20 rounded bg-gray-100 animate-pulse dark:bg-white/5" />
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- ERROR STATE -->
    <!-- ============================================================ -->
    <div v-else-if="error" class="px-5 py-16 text-center">
      <p class="text-base font-medium text-gray-600 dark:text-gray-400">{{ error }}</p>
      <button
        class="mt-4 rounded-2xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-md active:scale-95 transition-transform dark:bg-white dark:text-gray-900"
        @click="() => fetchCatalog()"
      >
        Reintentar
      </button>
    </div>

    <!-- ============================================================ -->
    <!-- CATALOG CONTENT -->
    <!-- ============================================================ -->
    <template v-else>
      <!-- Store disabled -->
      <div v-if="business && !storeInfo" class="px-5 py-16 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5">
          <ShoppingBag :size="28" class="text-gray-400" />
        </div>
        <p class="text-base font-medium text-gray-600 dark:text-gray-300">Esta tienda no esta disponible</p>
        <p class="mt-1 text-sm text-gray-400 dark:text-gray-500">El vendedor aun no ha activado su tienda online.</p>
      </div>

      <!-- No products -->
      <div v-else-if="products.length === 0" class="px-5 py-16 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5">
          <ShoppingBag :size="28" class="text-gray-400" />
        </div>
        <p class="text-base font-medium text-gray-600 dark:text-gray-300">No hay productos disponibles</p>
        <p class="mt-1 text-sm text-gray-400 dark:text-gray-500">El vendedor aun no ha agregado productos a su tienda.</p>
      </div>

      <!-- ============================================================ -->
      <!-- NORMAL CATALOG -->
      <!-- ============================================================ -->
      <template v-else>
        <!-- SEARCH BAR -->
        <div class="px-5 pb-3">
          <div class="relative flex-1">
            <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" :size="18" />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="`Buscar en ${business?.name ?? 'tienda'}...`"
              class="w-full rounded-2xl border-transparent bg-gray-50 py-3.5 pl-11 pr-4 text-sm font-medium text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-200 focus:bg-white focus:ring-4 focus:ring-gray-50 dark:bg-white/5 dark:text-white dark:placeholder-gray-500 dark:focus:border-gray-700 dark:focus:bg-gray-800 dark:focus:ring-gray-800/50"
            >
          </div>
        </div>

        <!-- CATEGORY CHIPS (sticky) -->
        <div
          v-if="categories.length > 0"
          class="sticky top-0 z-20 border-b border-gray-100 bg-white py-3 pl-5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] dark:border-white/8 dark:bg-black"
        >
          <div class="no-scrollbar flex gap-2.5 overflow-x-auto pr-5 pb-1">
            <button
              class="flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold tracking-wide transition-colors"
              :class="
                selectedCategory === null
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'border border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-white/8 dark:bg-white/5 dark:text-gray-300'
              "
              @click="selectedCategory = null"
            >
              <LayoutGrid :size="14" class="opacity-80" />
              Todos
            </button>
            <button
              v-for="cat in categories"
              :key="cat.id"
              class="flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium transition-colors"
              :class="
                selectedCategory === cat.name
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'border border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-white/8 dark:bg-white/5 dark:text-gray-300'
              "
              @click="selectedCategory = cat.name"
            >
              {{ cat.name }}
            </button>
          </div>
        </div>

        <!-- SCROLLABLE CONTENT -->
        <div class="bg-[#FAFAFA] px-5 pt-5 dark:bg-black">
          <!-- INFO BANNER -->
          <div
            v-if="storeInfo && (storeInfo.welcomeMessage || todayHours || exchangeRate || storeInfo.deliveryEnabled)"
            class="mb-6 flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm dark:border-white/8 dark:bg-[#111]"
          >
            <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400">
              <Info :size="14" />
            </div>
            <div class="text-[11px] font-medium leading-relaxed text-gray-500 dark:text-gray-400">
              <p v-if="storeInfo.welcomeMessage" class="mb-1">
                <span class="font-semibold text-gray-900 dark:text-white">{{ storeInfo.welcomeMessage }}</span>
              </p>
              <p v-if="exchangeRate">
                <span class="font-semibold text-gray-900 dark:text-white">Tasa BCV:</span>
                Bs. {{ exchangeRate.toFixed(2) }} por $1.
              </p>
              <p v-if="todayHours" class="flex items-center gap-1">
                <span
                  class="inline-block h-1.5 w-1.5 rounded-full"
                  :class="todayHours.open ? 'bg-green-500' : 'bg-red-400'"
                />
                {{ todayHours.label }}
              </p>
              <p v-if="storeInfo.deliveryEnabled">
                Delivery {{ storeInfo.deliveryFee > 0 ? `$${storeInfo.deliveryFee.toFixed(2)}` : "gratis" }}
                <span v-if="storeInfo.deliveryZones" class="text-gray-400"> · {{ storeInfo.deliveryZones }}</span>
              </p>
              <p v-if="paymentLabels">Acepta: {{ paymentLabels }}</p>
              <p v-if="storeInfo.minOrderAmount > 0">
                Pedido min. ${{ storeInfo.minOrderAmount.toFixed(2) }}
              </p>
            </div>
          </div>

          <!-- SECTION TITLE -->
          <div class="mb-4 flex items-end justify-between px-1">
            <h2 class="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
              {{ selectedCategory ?? "Productos" }}
            </h2>
            <span class="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {{ filteredProducts.length }} {{ filteredProducts.length === 1 ? "producto" : "productos" }}
            </span>
          </div>

          <!-- EMPTY FILTERED STATE -->
          <div
            v-if="filteredProducts.length === 0"
            class="py-16 text-center text-gray-400"
          >
            <p class="text-base">
              {{ searchQuery.trim().length >= 2 ? "Sin resultados para tu busqueda." : "No hay productos en esta categoria." }}
            </p>
            <button
              v-if="searchQuery.trim().length >= 2"
              class="mt-3 text-sm font-medium text-gray-500 underline"
              @click="searchQuery = ''"
            >
              Limpiar busqueda
            </button>
          </div>

          <!-- PRODUCT GRID (universal visual layout) -->
          <div v-else class="grid grid-cols-2 gap-x-4 gap-y-7">
            <StorefrontProductCardVisual
              v-for="product in filteredProducts"
              :key="product.id"
              :product="product"
              :config="sfConfig"
              :exchange-rate="exchangeRate"
              :is-added="addedProductId === product.id"
              :resolve-image-url="resolveImageUrl"
              @add-to-cart="handleAddToCart"
            />
          </div>

          <!-- INFINITE SCROLL SENTINEL -->
          <div
            v-if="hasMore || isLoadingMore"
            ref="scrollSentinel"
            class="py-6 text-center"
          >
            <div
              v-if="isLoadingMore"
              class="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900"
            />
            <p v-else class="text-xs text-gray-400">Cargando mas productos...</p>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
