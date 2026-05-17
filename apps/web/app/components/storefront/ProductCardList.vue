<script setup lang="ts">
/**
 * List product card — horizontal row, minimal image, text-focused.
 *
 * Used for: peluqueria (services), distribuidora (wholesale).
 * Features: single-column list layout, description visible,
 * no carousel, CTA button on the right. Optimized for services
 * and businesses where images are secondary to product info.
 */

import { ShoppingBag } from "lucide-vue-next";
import type { StorefrontProduct } from "~/composables/useStorefront";
import type { StorefrontConfig } from "@nova/shared";

defineProps<{
  product: StorefrontProduct;
  config: StorefrontConfig;
  exchangeRate: number | null;
  isAdded: boolean;
  resolveImageUrl: (url: string | null) => string | undefined;
}>();

const emit = defineEmits<{
  addToCart: [product: StorefrontProduct];
}>();
</script>

<template>
  <div class="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition-all hover:shadow-md">
    <!-- Small image or icon -->
    <div class="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
      <img
        v-if="product.imageUrl"
        :src="resolveImageUrl(product.imageUrl)"
        :alt="product.name"
        class="h-full w-full object-cover"
        loading="lazy"
      >
      <div
        v-else
        class="flex h-full w-full items-center justify-center text-gray-300"
      >
        <ShoppingBag :size="20" />
      </div>
    </div>

    <!-- Info (center) -->
    <div class="min-w-0 flex-1">
      <!-- Category -->
      <p
        v-if="product.categoryName"
        class="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400"
      >
        {{ product.categoryName }}
      </p>

      <!-- Name -->
      <h3 class="truncate text-[13px] font-bold leading-tight text-gray-900">
        {{ product.name }}
      </h3>

      <!-- Description -->
      <p
        v-if="product.description"
        class="mt-0.5 truncate text-[11px] text-gray-500"
      >
        {{ product.description }}
      </p>

      <!-- SKU -->
      <p
        v-if="config.showSku && product.sku"
        class="mt-0.5 text-[10px] font-medium text-gray-400"
      >
        {{ product.sku }}
      </p>

      <!-- Price -->
      <div class="mt-1 flex items-baseline gap-2">
        <span class="text-[15px] font-bold tracking-tight text-gray-900">
          ${{ product.price.toFixed(2) }}
        </span>
        <span
          v-if="exchangeRate"
          class="text-[10px] font-medium text-gray-400"
        >
          Bs {{ (product.price * exchangeRate).toFixed(2) }}
        </span>
      </div>
    </div>

    <!-- CTA (right) -->
    <button
      v-if="product.available"
      class="flex-shrink-0 rounded-xl px-4 py-2 text-[12px] font-bold transition-all active:scale-95"
      :class="isAdded ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'"
      @click="emit('addToCart', product)"
    >
      {{ isAdded ? "Listo" : config.ctaText }}
    </button>

    <!-- Out of stock (replaces CTA) -->
    <span
      v-else
      class="flex-shrink-0 rounded-xl bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-500"
    >
      Agotado
    </span>
  </div>
</template>
