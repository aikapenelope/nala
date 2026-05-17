<script setup lang="ts">
/**
 * Storefront catalog page — premium product grid.
 *
 * Displays the tenant's products with sticky category chips,
 * search bar, info banner, and "add to cart" buttons.
 * Uses real data from GET /catalog/:slug (public, no auth).
 *
 * Design adapted from the Modern Multi-Tenant Catalog reference.
 */

import { currentDayOfWeekVET } from "@nova/shared";
import {
  Search,
  LayoutGrid,
  Info,
  ShoppingBag,
  Star,
} from "lucide-vue-next";

definePageMeta({ layout: "storefront" });

const config = useRuntimeConfig();
const storefrontApiBase = config.public.apiBase as string;

const {
  business,
  products,
  categories,
  storeInfo,
  exchangeRate,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  fetchCatalog,
  fetchMore,
} = useStorefront();
const { addItem } = useCart();

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

/** Filtered products by category and search query. */
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

/** Show brief "added" feedback on a product card + haptic vibration. */
function handleAddToCart(product: (typeof products.value)[number]) {
  addItem({
    id: product.id,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
  });
  addedProductId.value = product.id;

  // Haptic feedback on mobile (short vibration)
  if (import.meta.client && navigator.vibrate) {
    navigator.vibrate(50);
  }

  setTimeout(() => {
    addedProductId.value = null;
  }, 1200);
}

/**
 * Track the currently visible image index per product carousel.
 * Uses a scroll event listener to detect which slide is in view.
 */
const activeImageIndex = reactive<Record<string, number>>({});

function handleCarouselScroll(event: Event, productId: string, imageCount: number) {
  const el = event.target as HTMLElement;
  if (!el || imageCount <= 1) return;
  const slideWidth = el.scrollWidth / imageCount;
  const idx = Math.round(el.scrollLeft / slideWidth);
  activeImageIndex[productId] = idx;
}

onMounted(() => {
  if (products.value.length === 0) {
    fetchCatalog();
  }
});

/**
 * Infinite scroll: IntersectionObserver triggers fetchMore when the
 * sentinel element at the bottom of the product grid becomes visible.
 */
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
      <!-- Search skeleton -->
      <div class="mb-4">
        <div class="h-12 flex-1 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
      <!-- Category pills skeleton -->
      <div class="mb-5 flex gap-2.5">
        <div v-for="n in 4" :key="n" class="h-10 w-20 rounded-full bg-gray-100 animate-pulse" />
      </div>
      <!-- Grid skeleton -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-7">
        <div v-for="n in 4" :key="n" class="flex flex-col">
          <div class="aspect-[4/5] rounded-[24px] bg-gray-100 animate-pulse mb-3" />
          <div class="space-y-2 px-1">
            <div class="h-3 w-16 rounded bg-gray-100 animate-pulse" />
            <div class="h-4 w-28 rounded bg-gray-100 animate-pulse" />
            <div class="h-5 w-20 rounded bg-gray-100 animate-pulse" />
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- ERROR STATE -->
    <!-- ============================================================ -->
    <div v-else-if="error" class="px-5 py-16 text-center">
      <p class="text-base font-medium text-gray-600">{{ error }}</p>
      <button
        class="mt-4 rounded-2xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-md active:scale-95 transition-transform"
        @click="fetchCatalog"
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
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <ShoppingBag :size="28" class="text-gray-400" />
        </div>
        <p class="text-base font-medium text-gray-600">Esta tienda no esta disponible</p>
        <p class="mt-1 text-sm text-gray-400">El vendedor aun no ha activado su tienda online.</p>
      </div>

      <!-- No products -->
      <div v-else-if="products.length === 0" class="px-5 py-16 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <ShoppingBag :size="28" class="text-gray-400" />
        </div>
        <p class="text-base font-medium text-gray-600">No hay productos disponibles</p>
        <p class="mt-1 text-sm text-gray-400">El vendedor aun no ha agregado productos a su tienda.</p>
      </div>

      <!-- ============================================================ -->
      <!-- NORMAL CATALOG -->
      <!-- ============================================================ -->
      <template v-else>
        <!-- SEARCH & FILTER BAR -->
        <div class="px-5 pb-3">
          <div class="flex gap-3 items-center">
            <div class="relative flex-1">
              <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" :size="18" />
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="`Buscar en ${business?.name ?? 'tienda'}...`"
                class="w-full rounded-2xl border-transparent bg-gray-50 py-3.5 pl-11 pr-4 text-sm font-medium text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-gray-200 focus:bg-white focus:ring-4 focus:ring-gray-50"
              >
            </div>
          </div>
        </div>

        <!-- CATEGORY CHIPS (sticky) -->
        <div
          v-if="categories.length > 0"
          class="sticky top-0 z-20 border-b border-gray-100 bg-white py-3 pl-5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]"
        >
          <div class="no-scrollbar flex gap-2.5 overflow-x-auto pr-5 pb-1">
            <button
              class="flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold tracking-wide transition-colors"
              :class="
                selectedCategory === null
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100'
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
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100'
              "
              @click="selectedCategory = cat.name"
            >
              {{ cat.name }}
            </button>
          </div>
        </div>

        <!-- SCROLLABLE CONTENT -->
        <div class="bg-[#FAFAFA] px-5 pt-5">
          <!-- INFO BANNER -->
          <div
            v-if="storeInfo && (storeInfo.welcomeMessage || todayHours || exchangeRate || storeInfo.deliveryEnabled)"
            class="mb-6 flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm"
          >
            <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500">
              <Info :size="14" />
            </div>
            <div class="text-[11px] font-medium leading-relaxed text-gray-500">
              <!-- Welcome message -->
              <p v-if="storeInfo.welcomeMessage" class="mb-1">
                <span class="font-semibold text-gray-900">{{ storeInfo.welcomeMessage }}</span>
              </p>
              <!-- Exchange rate -->
              <p v-if="exchangeRate">
                <span class="font-semibold text-gray-900">Tasa BCV:</span>
                Bs. {{ exchangeRate.toFixed(2) }} por $1.
              </p>
              <!-- Business hours -->
              <p v-if="todayHours" class="flex items-center gap-1">
                <span
                  class="inline-block h-1.5 w-1.5 rounded-full"
                  :class="todayHours.open ? 'bg-green-500' : 'bg-red-400'"
                />
                {{ todayHours.label }}
              </p>
              <!-- Delivery -->
              <p v-if="storeInfo.deliveryEnabled">
                Delivery {{ storeInfo.deliveryFee > 0 ? `$${storeInfo.deliveryFee.toFixed(2)}` : "gratis" }}
                <span v-if="storeInfo.deliveryZones" class="text-gray-400"> · {{ storeInfo.deliveryZones }}</span>
              </p>
              <!-- Payment methods -->
              <p v-if="paymentLabels">Acepta: {{ paymentLabels }}</p>
              <!-- Minimum order -->
              <p v-if="storeInfo.minOrderAmount > 0">
                Pedido min. ${{ storeInfo.minOrderAmount.toFixed(2) }}
              </p>
            </div>
          </div>

          <!-- SECTION TITLE -->
          <div class="mb-4 flex items-end justify-between px-1">
            <h2 class="text-lg font-bold tracking-tight text-gray-900">
              {{ selectedCategory ?? "Productos" }}
            </h2>
            <span class="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
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

          <!-- ============================================================ -->
          <!-- PRODUCT GRID -->
          <!-- ============================================================ -->
          <div v-else class="grid grid-cols-2 gap-x-4 gap-y-7">
            <div
              v-for="product in filteredProducts"
              :key="product.id"
              class="group relative flex flex-col"
            >
              <!-- Product image -->
              <div class="relative mb-3 aspect-[4/5] w-full overflow-hidden rounded-[24px] bg-gray-100">
                <!-- Multi-image carousel -->
                <template v-if="product.images && product.images.length > 1">
                  <div
                    class="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto"
                    @scroll="handleCarouselScroll($event, product.id, product.images.length)"
                  >
                    <div
                      v-for="img in product.images"
                      :key="img.id"
                      class="h-full w-full flex-shrink-0 snap-center"
                    >
                      <img
                        :src="resolveImageUrl(img.url)"
                        :alt="product.name"
                        class="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                        :loading="img.sortOrder === 0 ? 'eager' : 'lazy'"
                      >
                    </div>
                  </div>
                  <!-- Dot indicators (active dot tracks scroll position) -->
                  <div class="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                    <span
                      v-for="(img, idx) in product.images"
                      :key="img.id"
                      class="h-1.5 w-1.5 rounded-full transition-colors"
                      :class="(activeImageIndex[product.id] ?? 0) === idx ? 'bg-gray-900/70' : 'bg-gray-900/25'"
                    />
                  </div>
                </template>
                <!-- Single image -->
                <template v-else-if="product.imageUrl">
                  <img
                    :src="resolveImageUrl(product.imageUrl)"
                    :alt="product.name"
                    class="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                    loading="lazy"
                  >
                </template>
                <!-- No image fallback -->
                <template v-else>
                  <div class="flex h-full w-full items-center justify-center text-gray-300">
                    <ShoppingBag :size="32" />
                  </div>
                </template>

                <!-- Out of stock overlay -->
                <div
                  v-if="!product.available"
                  class="absolute inset-0 flex items-center justify-center bg-white/70"
                >
                  <span class="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">
                    Agotado
                  </span>
                </div>

                <!-- Add to cart button (bottom-right of image) -->
                <button
                  v-if="product.available"
                  class="absolute bottom-3 right-3 z-10 flex h-[38px] w-[38px] items-center justify-center rounded-[14px] shadow-[0_8px_16px_rgba(0,0,0,0.15)] transition-all active:scale-95"
                  :class="
                    addedProductId === product.id
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-900/90 text-white backdrop-blur-md hover:bg-black'
                  "
                  @click="handleAddToCart(product)"
                >
                  <ShoppingBag :size="16" />
                </button>
              </div>

              <!-- Product info -->
              <div class="flex flex-col px-1">
                <!-- Category -->
                <p
                  v-if="product.categoryName"
                  class="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-gray-500"
                >
                  <Star :size="10" class="text-amber-400" />
                  {{ product.categoryName }}
                </p>

                <!-- Name -->
                <h3 class="mb-0.5 truncate text-[14px] font-bold leading-tight text-gray-900">
                  {{ product.name }}
                </h3>

                <!-- Description (truncated) -->
                <p
                  v-if="product.description"
                  class="mb-2 truncate text-[10px] font-medium uppercase tracking-wider text-gray-400"
                >
                  {{ product.description }}
                </p>

                <!-- Price -->
                <div class="flex flex-col">
                  <span class="text-[17px] font-bold tracking-tight text-gray-900">
                    ${{ product.price.toFixed(2) }}
                  </span>
                  <span
                    v-if="exchangeRate"
                    class="mt-0.5 text-[11px] font-medium text-gray-400"
                  >
                    Bs {{ (product.price * exchangeRate).toFixed(2) }}
                  </span>
                </div>
              </div>
            </div>
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
