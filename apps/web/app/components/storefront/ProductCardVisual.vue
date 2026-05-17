<script setup lang="ts">
/**
 * Visual product card — large image, carousel, overlay CTA.
 *
 * Used for: ropa, cosmeticos, electronica.
 * Features: 4:5 or square image, multi-image carousel with dots,
 * add-to-cart button overlaid on image, brand/description below.
 */

import { ShoppingBag, Star } from "lucide-vue-next";
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
  <div class="group relative flex flex-col">
    <!-- Image -->
    <div
      class="relative mb-3 w-full overflow-hidden rounded-[24px] bg-gray-100"
      :class="config.imageAspect"
    >
      <!-- Multi-image carousel -->
      <template v-if="config.showCarousel && product.images && product.images.length > 1">
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
              class="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
              :loading="img.sortOrder === 0 ? 'eager' : 'lazy'"
            >
          </div>
        </div>
        <!-- Dot indicators -->
        <div class="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
          <span
            v-for="(img, idx) in product.images"
            :key="img.id"
            class="h-1.5 w-1.5 rounded-full transition-colors"
            :class="activeImageIndex === idx ? 'bg-gray-900/70' : 'bg-gray-900/25'"
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
      <!-- No image -->
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

      <!-- CTA button overlay -->
      <button
        v-if="product.available"
        class="absolute bottom-3 right-3 z-10 flex h-[38px] w-[38px] items-center justify-center rounded-[14px] shadow-[0_8px_16px_rgba(0,0,0,0.15)] transition-all active:scale-95"
        :class="isAdded ? 'bg-green-500 text-white' : 'bg-gray-900/90 text-white backdrop-blur-md hover:bg-black'"
        @click="emit('addToCart', product)"
      >
        <ShoppingBag :size="16" />
      </button>
    </div>

    <!-- Product info -->
    <div class="flex flex-col px-1">
      <p
        v-if="product.categoryName"
        class="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-gray-500"
      >
        <Star :size="10" class="text-amber-400" />
        {{ product.categoryName }}
      </p>

      <h3 class="mb-0.5 truncate text-[14px] font-bold leading-tight text-gray-900">
        {{ product.name }}
      </h3>

      <p
        v-if="config.showBrand && product.brand"
        class="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-400"
      >
        {{ product.brand }}
      </p>

      <p
        v-if="config.showDescription && product.description"
        class="mb-2 truncate text-[10px] font-medium text-gray-400"
      >
        {{ product.description }}
      </p>

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
</template>
