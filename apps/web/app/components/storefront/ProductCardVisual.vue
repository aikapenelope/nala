<script setup lang="ts">
/**
 * Product card — visual layout with image, info, and add-to-cart.
 *
 * Universal card for all business types. Features:
 * - Image with carousel support (multi-image swipe)
 * - Product name, category, description (2 lines)
 * - Price in USD + Bs conversion
 * - Full-width "Agregar" button below the card (not just an icon)
 */

import { ShoppingBag, Plus, Check } from "lucide-vue-next";
import type { StorefrontProduct } from "~/composables/useStorefront";
import type { StorefrontConfig } from "@nova/shared";

const props = defineProps<{
  product: StorefrontProduct;
  config: StorefrontConfig;
  exchangeRate: number | null;
  isAdded: boolean;
  resolveImageUrl: (url: string | null) => string | undefined;
}>();

const emit = defineEmits<{
  addToCart: [product: StorefrontProduct];
}>();

/** Track carousel active image index. */
const activeImageIndex = ref(0);

function handleScroll(event: Event) {
  const el = event.target as HTMLElement;
  if (!el || !props.product.images || props.product.images.length <= 1) return;
  const slideWidth = el.scrollWidth / props.product.images.length;
  activeImageIndex.value = Math.round(el.scrollLeft / slideWidth);
}
</script>

<template>
  <div class="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md">
    <!-- Image (links to product detail) -->
    <NuxtLink :to="`/tienda/product/${product.id}`" class="relative aspect-square w-full overflow-hidden bg-gray-50">
      <!-- Multi-image carousel -->
      <template v-if="product.images && product.images.length > 1">
        <div
          class="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto"
          @scroll="handleScroll"
        >
          <div
            v-for="img in product.images"
            :key="img.id"
            class="h-full w-full flex-shrink-0 snap-center"
          >
            <img
              :src="resolveImageUrl(img.url)"
              :alt="product.name"
              class="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
              :loading="img.sortOrder === 0 ? 'eager' : 'lazy'"
            >
          </div>
        </div>
        <!-- Dot indicators -->
        <div class="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          <span
            v-for="(img, idx) in product.images"
            :key="img.id"
            class="h-1.5 w-1.5 rounded-full transition-all"
            :class="activeImageIndex === idx ? 'bg-white shadow-sm scale-125' : 'bg-white/50'"
          />
        </div>
      </template>
      <!-- Single image -->
      <template v-else-if="product.imageUrl">
        <img
          :src="resolveImageUrl(product.imageUrl)"
          :alt="product.name"
          class="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
          loading="lazy"
        >
      </template>
      <!-- No image -->
      <template v-else>
        <div class="flex h-full w-full items-center justify-center bg-gray-100 text-gray-300">
          <ShoppingBag :size="36" />
        </div>
      </template>

      <!-- Out of stock overlay -->
      <div
        v-if="!product.available"
        class="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-[2px]"
      >
        <span class="rounded-full bg-red-50 px-4 py-1.5 text-xs font-bold text-red-600 ring-1 ring-red-100">
          Agotado
        </span>
      </div>
    </NuxtLink>

    <!-- Product info -->
    <div class="flex flex-1 flex-col p-3">
      <!-- Category -->
      <p
        v-if="product.categoryName"
        class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400"
      >
        {{ product.categoryName }}
      </p>

      <!-- Name -->
      <h3 class="text-sm font-bold leading-tight text-gray-900">
        {{ product.name }}
      </h3>

      <!-- Description (2 lines max) -->
      <p
        v-if="product.description"
        class="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500"
      >
        {{ product.description }}
      </p>

      <!-- Price -->
      <div class="mt-auto pt-2">
        <div class="flex items-baseline gap-1.5">
          <span class="text-lg font-bold tracking-tight text-gray-900">
            ${{ product.price.toFixed(2) }}
          </span>
          <span
            v-if="exchangeRate"
            class="text-[11px] font-medium text-gray-400"
          >
            Bs {{ (product.price * exchangeRate).toFixed(2) }}
          </span>
        </div>
      </div>

      <!-- Add to cart button (full width, below info) -->
      <button
        v-if="product.available"
        class="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97]"
        :class="
          isAdded
            ? 'bg-green-500 text-white'
            : 'bg-gray-900 text-white hover:bg-gray-800'
        "
        @click="emit('addToCart', product)"
      >
        <Check v-if="isAdded" :size="14" />
        <Plus v-else :size="14" />
        {{ isAdded ? "Agregado" : "Agregar" }}
      </button>
    </div>
  </div>
</template>
