<script setup lang="ts">
/**
 * Compact product card — small square image, dense info, inline CTA.
 *
 * Used for: bodega, farmacia, ferreteria, autopartes, libreria.
 * Features: 1:1 image, SKU/brand when configured, inline add button,
 * optimized for high-density product grids.
 */

import { ShoppingBag, Plus } from "lucide-vue-next";
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
  <div class="flex overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md">
    <!-- Image (square, left side) -->
    <div class="relative h-28 w-28 flex-shrink-0 bg-gray-100">
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
        <ShoppingBag :size="24" />
      </div>

      <!-- Out of stock badge -->
      <div
        v-if="!product.available"
        class="absolute inset-0 flex items-center justify-center bg-white/70"
      >
        <span class="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
          Agotado
        </span>
      </div>
    </div>

    <!-- Info (right side) -->
    <div class="flex min-w-0 flex-1 flex-col justify-between p-3">
      <div>
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

        <!-- SKU -->
        <p
          v-if="config.showSku && product.sku"
          class="mt-0.5 text-[10px] font-medium text-gray-400"
        >
          SKU: {{ product.sku }}
        </p>

        <!-- Brand -->
        <p
          v-if="config.showBrand && product.brand"
          class="text-[10px] font-medium text-gray-500"
        >
          {{ product.brand }}
        </p>
      </div>

      <!-- Price + CTA row -->
      <div class="mt-1.5 flex items-end justify-between">
        <div>
          <span class="text-[15px] font-bold tracking-tight text-gray-900">
            ${{ product.price.toFixed(2) }}
          </span>
          <p
            v-if="exchangeRate"
            class="text-[10px] font-medium text-gray-400"
          >
            Bs {{ (product.price * exchangeRate).toFixed(2) }}
          </p>
        </div>

        <!-- Inline CTA -->
        <button
          v-if="product.available"
          class="flex h-8 items-center gap-1 rounded-xl px-3 text-[11px] font-bold transition-all active:scale-95"
          :class="isAdded ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'"
          @click="emit('addToCart', product)"
        >
          <Plus v-if="!isAdded" :size="12" />
          {{ isAdded ? "Listo" : config.ctaText }}
        </button>
      </div>
    </div>
  </div>
</template>
