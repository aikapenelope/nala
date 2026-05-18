<script setup lang="ts">
/**
 * Product detail page — full image, description, price, add to cart.
 *
 * Accessed by tapping a product image in the catalog.
 * Uses the product data already loaded by useStorefront() (no extra API call).
 * If the product is not found in the loaded catalog, shows a fallback.
 */

import {
  ArrowLeft,
  ShoppingBag,
  Plus,
  Check,
  Share2,
} from "lucide-vue-next";

definePageMeta({ layout: "storefront" });

const route = useRoute();
const productId = route.params.id as string;

const runtimeConfig = useRuntimeConfig();
const storefrontApiBase = runtimeConfig.public.apiBase as string;

const { products, exchangeRate, business } = useStorefront();
const { addItem } = useCart();

function resolveImageUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `${storefrontApiBase}${url}`;
}

/** Find the product in the already-loaded catalog. */
const product = computed(() =>
  products.value.find((p) => p.id === productId) ?? null,
);

useStorefrontSeo({
  title: product.value?.name ?? "Producto",
  description: product.value?.description ?? undefined,
});

/** Active image index for the gallery. */
const activeImageIndex = ref(0);

function selectImage(idx: number) {
  activeImageIndex.value = idx;
}

/** All images: gallery images or fallback to single imageUrl. */
const allImages = computed(() => {
  if (product.value?.images && product.value.images.length > 0) {
    return product.value.images.map((img) => ({
      id: img.id,
      url: resolveImageUrl(img.url),
    }));
  }
  if (product.value?.imageUrl) {
    return [{ id: "main", url: resolveImageUrl(product.value.imageUrl) }];
  }
  return [];
});

/** Current main image URL. */
const mainImage = computed(() => allImages.value[activeImageIndex.value]?.url);

/** Add to cart state. */
const isAdded = ref(false);

function handleAddToCart() {
  if (!product.value || !product.value.available) return;
  addItem({
    id: product.value.id,
    name: product.value.name,
    price: product.value.price,
    imageUrl: product.value.imageUrl,
  });
  isAdded.value = true;
  if (import.meta.client && navigator.vibrate) {
    navigator.vibrate(50);
  }
  setTimeout(() => { isAdded.value = false; }, 1500);
}

/** Share via Web Share API or copy link. */
async function shareProduct() {
  if (!product.value || !import.meta.client) return;
  const url = window.location.href;
  const text = `${product.value.name} - $${product.value.price.toFixed(2)}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: product.value.name, text, url });
    } catch {
      // User cancelled or share failed
    }
  } else {
    await navigator.clipboard.writeText(url);
  }
}
</script>

<template>
  <div class="px-5 pt-2 pb-6">
    <!-- Back -->
    <NuxtLink
      to="/tienda"
      class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
    >
      <ArrowLeft :size="16" />
      Catalogo
    </NuxtLink>

    <!-- Not found -->
    <div v-if="!product" class="py-16 text-center">
      <ShoppingBag :size="40" class="mx-auto text-gray-300" />
      <p class="mt-4 text-base font-medium text-gray-600">Producto no encontrado</p>
      <NuxtLink to="/tienda" class="mt-4 inline-block text-sm font-semibold text-gray-900 underline">
        Volver al catalogo
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Main image -->
      <div class="relative aspect-square w-full overflow-hidden rounded-2xl bg-gray-100">
        <img
          v-if="mainImage"
          :src="mainImage"
          :alt="product.name"
          class="h-full w-full object-cover object-center"
        >
        <div v-else class="flex h-full w-full items-center justify-center text-gray-300">
          <ShoppingBag :size="48" />
        </div>

        <!-- Out of stock -->
        <div
          v-if="!product.available"
          class="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-[2px]"
        >
          <span class="rounded-full bg-red-50 px-4 py-1.5 text-sm font-bold text-red-600 ring-1 ring-red-100">
            Agotado
          </span>
        </div>

        <!-- Share button -->
        <button
          class="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm backdrop-blur-sm transition-all active:scale-95"
          @click="shareProduct"
        >
          <Share2 :size="18" />
        </button>
      </div>

      <!-- Thumbnail gallery -->
      <div
        v-if="allImages.length > 1"
        class="mt-3 flex gap-2 overflow-x-auto no-scrollbar"
      >
        <button
          v-for="(img, idx) in allImages"
          :key="img.id"
          class="h-16 w-16 shrink-0 overflow-hidden rounded-xl transition-all"
          :class="activeImageIndex === idx ? 'ring-2 ring-gray-900 ring-offset-1' : 'opacity-60 hover:opacity-100'"
          @click="selectImage(idx)"
        >
          <img
            v-if="img.url"
            :src="img.url"
            :alt="`Imagen ${idx + 1}`"
            class="h-full w-full object-cover"
          >
        </button>
      </div>

      <!-- Product info -->
      <div class="mt-5">
        <!-- Category -->
        <p
          v-if="product.categoryName"
          class="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400"
        >
          {{ product.categoryName }}
        </p>

        <!-- Name -->
        <h1 class="text-2xl font-bold tracking-tight text-gray-900">
          {{ product.name }}
        </h1>

        <!-- Price -->
        <div class="mt-2 flex items-baseline gap-2">
          <span class="text-3xl font-bold tracking-tight text-gray-900">
            ${{ product.price.toFixed(2) }}
          </span>
          <span
            v-if="exchangeRate"
            class="text-sm font-medium text-gray-400"
          >
            Bs {{ (product.price * exchangeRate).toFixed(2) }}
          </span>
        </div>

        <!-- Description -->
        <div
          v-if="product.description"
          class="mt-4 rounded-2xl bg-gray-50 p-4"
        >
          <p class="text-sm font-semibold text-gray-700 mb-1">Descripcion</p>
          <p class="text-sm leading-relaxed text-gray-600 whitespace-pre-line">
            {{ product.description }}
          </p>
        </div>

        <!-- Brand / SKU -->
        <div
          v-if="product.brand || product.sku"
          class="mt-3 flex flex-wrap gap-2"
        >
          <span
            v-if="product.brand"
            class="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
          >
            {{ product.brand }}
          </span>
          <span
            v-if="product.sku"
            class="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500"
          >
            SKU: {{ product.sku }}
          </span>
        </div>

        <!-- Add to cart -->
        <button
          v-if="product.available"
          class="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold transition-all active:scale-[0.97]"
          :class="
            isAdded
              ? 'bg-green-500 text-white'
              : 'bg-gray-900 text-white shadow-lg shadow-gray-900/20 hover:bg-gray-800'
          "
          @click="handleAddToCart"
        >
          <Check v-if="isAdded" :size="20" />
          <Plus v-else :size="20" />
          {{ isAdded ? "Agregado al carrito" : "Agregar al carrito" }}
        </button>

        <!-- WhatsApp contact -->
        <a
          v-if="business?.whatsappNumber"
          :href="`https://wa.me/${business.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola, me interesa: ${product.name} ($${product.price.toFixed(2)})`)}`"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-green-200 bg-green-50 text-sm font-bold text-green-700 transition-all active:scale-[0.97]"
        >
          Preguntar por WhatsApp
        </a>
      </div>
    </template>
  </div>
</template>
