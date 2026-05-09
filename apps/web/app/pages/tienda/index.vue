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

const { business, products, categories, isLoading, error, fetchCatalog } =
  useStorefront();
const { addItem, itemCount } = useCart();

useStorefrontSeo({ title: "Catalogo" });

const selectedCategory = ref<string | null>(null);
const addedProductId = ref<string | null>(null);

/** Filtered products by selected category. */
const filteredProducts = computed(() => {
  if (!selectedCategory.value) return products.value;
  return products.value.filter(
    (p) => p.categoryName === selectedCategory.value,
  );
});

/** Show brief "added" feedback on a product card. */
function handleAddToCart(product: (typeof products.value)[number]) {
  addItem({
    id: product.id,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
  });
  addedProductId.value = product.id;
  setTimeout(() => {
    addedProductId.value = null;
  }, 1200);
}

onMounted(() => {
  if (products.value.length === 0) {
    fetchCatalog();
  }
});
</script>

<template>
  <div>
    <!-- Store name in layout header slot -->
    <Teleport to="header">
      <span v-if="business">{{ business.name }}</span>
    </Teleport>

    <!-- Loading state -->
    <div v-if="isLoading" class="space-y-4 py-8">
      <div class="mx-auto h-6 w-48 animate-pulse rounded-lg bg-gray-200" />
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="n in 4"
          :key="n"
          class="h-52 animate-pulse rounded-2xl bg-gray-200"
        />
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
      <!-- Welcome message -->
      <div v-if="business" class="mb-5">
        <h1 class="text-xl font-bold text-gray-900">{{ business.name }}</h1>
        <p v-if="business.address" class="mt-0.5 text-sm text-gray-500">
          {{ business.address }}
        </p>
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

      <!-- Empty state -->
      <div
        v-if="filteredProducts.length === 0"
        class="py-16 text-center text-gray-400"
      >
        <p class="text-base">No hay productos disponibles.</p>
      </div>

      <!-- Products grid -->
      <div v-else class="grid grid-cols-2 gap-3">
        <div
          v-for="product in filteredProducts"
          :key="product.id"
          class="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
        >
          <!-- Product image -->
          <div class="relative aspect-square bg-gray-50">
            <img
              v-if="product.imageUrl"
              :src="product.imageUrl"
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
            <h3 class="mt-0.5 text-sm font-semibold leading-tight text-gray-900">
              {{ product.name }}
            </h3>
            <p class="mt-1 text-base font-bold text-gray-900">
              ${{ product.price.toFixed(2) }}
            </p>

            <!-- Add to cart button -->
            <button
              v-if="product.available"
              class="mt-2 w-full rounded-xl py-2 text-xs font-bold transition-all"
              :class="
                addedProductId === product.id
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
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
    </template>

    <!-- Floating cart button (when items in cart) -->
    <Teleport to="body">
      <NuxtLink
        v-if="itemCount > 0"
        to="/tienda/cart"
        class="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-gray-900 px-6 py-3.5 text-sm font-bold text-white shadow-xl transition-transform hover:scale-105"
      >
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
        Ver carrito ({{ itemCount }})
      </NuxtLink>
    </Teleport>
  </div>
</template>
