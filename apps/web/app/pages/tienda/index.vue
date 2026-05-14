<script setup lang="ts">
/**
 * Storefront catalog page.
 *
 * Displays the tenant's products with category filters and
 * "Agregar al carrito" buttons. Uses the storefront layout.
 *
 * Connected to: GET /catalog/:slug (public, no auth)
 */

definePageMeta({ layout: "storefront" });

const config = useRuntimeConfig();
const storefrontApiBase = config.public.apiBase as string;

const { business, products, categories, storeInfo, exchangeRate, isLoading, isLoadingMore, hasMore, error, fetchCatalog, fetchMore } =
  useStorefront();
const { addItem, itemCount, subtotal } = useCart();

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
  const dayIdx = new Date().getDay();
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

  // Watch for the sentinel element to appear in the DOM
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
    <!-- Loading state (shimmer skeleton) -->
    <div v-if="isLoading" class="space-y-4 py-8">
      <div class="mx-auto h-6 w-48 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
      <div class="h-10 rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="n in 4"
          :key="n"
          class="overflow-hidden rounded-2xl"
        >
          <div class="aspect-square bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
          <div class="space-y-2 p-3">
            <div class="h-3 w-16 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
            <div class="h-4 w-24 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
            <div class="h-5 w-14 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
          </div>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="py-16 text-center">
      <p class="text-base font-medium text-gray-600">{{ error }}</p>
      <button
        class="mt-4 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white"
        @click="fetchCatalog"
      >
        Reintentar
      </button>
    </div>

    <!-- Catalog content -->
    <template v-else>
      <!-- Store disabled -->
      <div
        v-if="business && !storeInfo"
        class="py-16 text-center"
      >
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
            <path d="M2 7h20" />
          </svg>
        </div>
        <p class="text-base font-medium text-gray-600">
          Esta tienda no esta disponible
        </p>
        <p class="mt-1 text-sm text-gray-400">
          El vendedor aun no ha activado su tienda online.
        </p>
      </div>

      <!-- No products -->
      <div
        v-else-if="products.length === 0"
        class="py-16 text-center"
      >
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">
            <path d="m7.5 4.27 9 5.15" />
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22V12" />
          </svg>
        </div>
        <p class="text-base font-medium text-gray-600">
          No hay productos disponibles
        </p>
        <p class="mt-1 text-sm text-gray-400">
          El vendedor aun no ha agregado productos a su tienda.
        </p>
      </div>

      <!-- Normal catalog -->
      <template v-else>
      <!-- Welcome message -->
      <div v-if="business" class="mb-4">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ business.name }}</h1>
        <p v-if="business.address" class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {{ business.address }}
        </p>
      </div>

      <!-- Store info banner -->
      <div
        v-if="storeInfo && (storeInfo.welcomeMessage || todayHours || storeInfo.deliveryEnabled || paymentLabels)"
        class="mb-4 space-y-2 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
      >
        <!-- Welcome message -->
        <p v-if="storeInfo.welcomeMessage" class="text-sm text-gray-700 dark:text-gray-300">
          {{ storeInfo.welcomeMessage }}
        </p>

        <div class="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
          <!-- Business hours (today) -->
          <span v-if="todayHours" class="flex items-center gap-1">
            <span
              class="inline-block h-1.5 w-1.5 rounded-full"
              :class="todayHours.open ? 'bg-green-500' : 'bg-red-400'"
            />
            {{ todayHours.label }}
          </span>

          <!-- Delivery -->
          <span v-if="storeInfo.deliveryEnabled" class="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
            Delivery {{ storeInfo.deliveryFee > 0 ? `$${storeInfo.deliveryFee.toFixed(2)}` : "gratis" }}
            <span v-if="storeInfo.deliveryZones" class="text-gray-400">· {{ storeInfo.deliveryZones }}</span>
          </span>

          <!-- Accepted payment methods -->
          <span v-if="paymentLabels" class="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            {{ paymentLabels }}
          </span>

          <!-- Minimum order -->
          <span v-if="storeInfo.minOrderAmount > 0" class="flex items-center gap-1">
            Pedido min. ${{ storeInfo.minOrderAmount.toFixed(2) }}
          </span>
        </div>
      </div>

      <!-- Search input -->
      <div class="relative mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar productos..."
          class="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-600 dark:focus:ring-gray-700"
        >
      </div>

      <!-- Category filter pills -->
      <div
        v-if="categories.length > 0"
        class="-mx-4 mb-5 overflow-x-auto px-4"
      >
        <div class="flex gap-2">
          <button
            class="flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            :class="
              selectedCategory === null
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            "
            @click="selectedCategory = null"
          >
            Todos
          </button>
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            :class="
              selectedCategory === cat.name
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            "
            @click="selectedCategory = cat.name"
          >
            {{ cat.name }}
          </button>
        </div>
      </div>

      <!-- Empty state (filtered) -->
      <div
        v-if="filteredProducts.length === 0"
        class="py-16 text-center text-gray-400"
      >
        <p class="text-base">
          {{ searchQuery.trim().length >= 2 ? "Sin resultados para tu busqueda." : "No hay productos disponibles." }}
        </p>
        <button
          v-if="searchQuery.trim().length >= 2"
          class="mt-3 text-sm font-medium text-gray-500 underline"
          @click="searchQuery = ''"
        >
          Limpiar busqueda
        </button>
      </div>

      <!-- Products grid -->
      <div v-else class="grid grid-cols-2 gap-3">
        <div
          v-for="product in filteredProducts"
          :key="product.id"
          class="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <!-- Product image carousel -->
          <div class="relative aspect-square bg-gray-50 overflow-hidden">
            <!-- Multi-image carousel (swipe on mobile) -->
            <template v-if="product.images && product.images.length > 1">
              <div
                class="flex h-full w-full snap-x snap-mandatory overflow-x-auto scrollbar-hide"
                :data-product-id="product.id"
              >
                <div
                  v-for="img in product.images"
                  :key="img.id"
                  class="h-full w-full flex-shrink-0 snap-center"
                >
                  <img
                    :src="resolveImageUrl(img.url)"
                    :alt="product.name"
                    class="h-full w-full object-cover"
                    :loading="img.sortOrder === 0 ? 'eager' : 'lazy'"
                  >
                </div>
              </div>
              <!-- Dot indicators -->
              <div class="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                <span
                  v-for="(img, idx) in product.images"
                  :key="img.id"
                  class="h-1.5 w-1.5 rounded-full"
                  :class="idx === 0 ? 'bg-gray-900/70' : 'bg-gray-900/25'"
                />
              </div>
            </template>
            <!-- Single image or fallback -->
            <template v-else>
              <img
                v-if="product.imageUrl"
                :src="resolveImageUrl(product.imageUrl)"
                :alt="product.name"
                class="h-full w-full object-cover"
                loading="lazy"
              >
              <div
                v-else
                class="flex h-full w-full items-center justify-center text-3xl text-gray-300"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m7.5 4.27 9 5.15" />
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  <path d="m3.3 7 8.7 5 8.7-5" />
                  <path d="M12 22V12" />
                </svg>
              </div>
            </template>

            <!-- Out of stock badge -->
            <div
              v-if="!product.available"
              class="absolute inset-0 flex items-center justify-center bg-white/70"
            >
              <span
                class="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600"
              >
                Agotado
              </span>
            </div>
          </div>

          <!-- Product info -->
          <div class="p-3">
            <p
              v-if="product.categoryName"
              class="text-[10px] font-semibold uppercase tracking-wide text-gray-400"
            >
              {{ product.categoryName }}
            </p>
            <h3 class="mt-0.5 text-sm font-semibold leading-tight text-gray-900 dark:text-white">
              {{ product.name }}
            </h3>
            <p class="mt-1 text-base font-bold text-gray-900 dark:text-white">
              ${{ product.price.toFixed(2) }}
            </p>
            <p
              v-if="exchangeRate"
              class="text-xs font-medium text-gray-400"
            >
              Bs. {{ (product.price * exchangeRate).toFixed(2) }}
            </p>

            <!-- Add to cart button -->
            <button
              v-if="product.available"
              class="mt-2 w-full rounded-xl py-2 text-xs font-bold transition-all"
              :class="
                addedProductId === product.id
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200'
              "
              :disabled="addedProductId === product.id"
              @click="handleAddToCart(product)"
            >
              {{
                addedProductId === product.id
                  ? "Agregado!"
                  : "Agregar al carrito"
              }}
            </button>
          </div>
        </div>
      </div>

      <!-- Infinite scroll sentinel + loading indicator -->
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
      </template>
    </template>

    <!-- Floating cart button (when items in cart) -->
    <Teleport to="body">
      <NuxtLink
        v-if="itemCount > 0"
        to="/tienda/cart"
        class="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-gray-900 px-6 py-3.5 text-sm font-bold text-white shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-transform hover:scale-105 dark:bg-white dark:text-gray-900 dark:shadow-[0_8px_30px_rgba(255,255,255,0.15)]"
      >
        <div class="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="8" cy="21" r="1" />
            <circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
          </svg>
          <span>Ver carrito ({{ itemCount }})</span>
        </div>
        <span class="border-l border-white/20 pl-3 text-white/80">
          ${{ subtotal.toFixed(2) }}
        </span>
      </NuxtLink>
    </Teleport>
  </div>
</template>
