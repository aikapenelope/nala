<script setup lang="ts">
/**
 * Storefront cart page — premium design.
 *
 * Shows cart items with quantity controls, subtotal,
 * and a button to proceed to checkout.
 */

import { ArrowLeft, ShoppingBag, X, Minus, Plus, Trash2 } from "lucide-vue-next";

definePageMeta({ layout: "storefront" });

const config = useRuntimeConfig();
const storefrontApiBase = config.public.apiBase as string;

const { items, removeItem, updateQuantity, itemCount, subtotal, clear } =
  useCart();
const { storeInfo, exchangeRate } = useStorefront();

/** Resolve image URL: prepend API base for relative paths from the catalog API. */
function resolveImageUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `${storefrontApiBase}${url}`;
}

useStorefrontSeo({ title: "Carrito" });

/** Delivery fee (if applicable). */
const deliveryFee = computed(() => {
  if (!storeInfo.value?.deliveryEnabled) return 0;
  return storeInfo.value.deliveryFee;
});

/** Total including delivery. */
const total = computed(() => subtotal.value + deliveryFee.value);

/** Minimum order check. */
const meetsMinimum = computed(() => {
  if (!storeInfo.value?.minOrderAmount) return true;
  return subtotal.value >= storeInfo.value.minOrderAmount;
});
</script>

<template>
  <div class="px-5 pt-2">
    <!-- Back link -->
    <NuxtLink
      to="/tienda"
      class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
    >
      <ArrowLeft :size="16" />
      Seguir comprando
    </NuxtLink>

    <h1 class="mb-5 text-xl font-bold tracking-tight text-gray-900 dark:text-white">Tu carrito</h1>

    <!-- Empty cart -->
    <div v-if="itemCount === 0" class="py-16 text-center">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5">
        <ShoppingBag :size="28" class="text-gray-400" />
      </div>
      <p class="text-base font-medium text-gray-600 dark:text-gray-300">Tu carrito esta vacio</p>
      <p class="mt-1 text-sm text-gray-400 dark:text-gray-500">
        Agrega productos desde el catalogo.
      </p>
      <NuxtLink
        to="/tienda"
        class="mt-5 inline-block rounded-2xl bg-gray-900 px-6 py-3 text-sm font-bold text-white shadow-md transition-transform active:scale-95 dark:bg-white dark:text-gray-900"
      >
        Ver catalogo
      </NuxtLink>
    </div>

    <!-- Cart items -->
    <template v-else>
      <div class="space-y-3">
        <div
          v-for="item in items"
          :key="item.productId"
          class="flex gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <!-- Product image -->
          <div class="h-20 w-20 flex-shrink-0 overflow-hidden rounded-[16px] bg-gray-100 dark:bg-white/5">
            <img
              v-if="item.imageUrl"
              :src="resolveImageUrl(item.imageUrl)"
              :alt="item.name"
              class="h-full w-full object-cover"
            >
            <div
              v-else
              class="flex h-full w-full items-center justify-center text-gray-300"
            >
              <ShoppingBag :size="20" />
            </div>
          </div>

          <!-- Item details -->
          <div class="flex min-w-0 flex-1 flex-col justify-between">
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm font-bold leading-tight text-gray-900 dark:text-white">
                {{ item.name }}
              </p>
              <button
                class="flex-shrink-0 rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                aria-label="Eliminar"
                @click="removeItem(item.productId)"
              >
                <X :size="16" />
              </button>
            </div>

            <div class="mt-1.5 flex items-center justify-between">
              <!-- Quantity controls -->
              <div class="flex items-center gap-1.5">
                <button
                  class="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-50 border border-gray-100 text-gray-700 hover:bg-gray-100 transition-colors dark:bg-white/5 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                  @click="updateQuantity(item.productId, item.quantity - 1)"
                >
                  <Minus :size="14" />
                </button>
                <span class="min-w-[28px] text-center text-sm font-bold text-gray-900 dark:text-white">
                  {{ item.quantity }}
                </span>
                <button
                  class="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-50 border border-gray-100 text-gray-700 hover:bg-gray-100 transition-colors dark:bg-white/5 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                  @click="updateQuantity(item.productId, item.quantity + 1)"
                >
                  <Plus :size="14" />
                </button>
              </div>

              <!-- Line total -->
              <div class="text-right">
                <p class="text-[15px] font-bold tracking-tight text-gray-900 dark:text-white">
                  ${{ (item.price * item.quantity).toFixed(2) }}
                </p>
                <p
                  v-if="exchangeRate"
                  class="text-[11px] font-medium text-gray-400"
                >
                  Bs {{ (item.price * item.quantity * exchangeRate).toFixed(2) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Clear cart -->
      <button
        class="mt-4 flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors"
        @click="clear"
      >
        <Trash2 :size="12" />
        Vaciar carrito
      </button>

      <!-- Summary -->
      <div class="mt-6 space-y-2.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div class="flex justify-between text-sm text-gray-600">
          <span>Subtotal ({{ itemCount }} {{ itemCount === 1 ? "item" : "items" }})</span>
          <div class="text-right">
            <span class="font-semibold">${{ subtotal.toFixed(2) }}</span>
            <p v-if="exchangeRate" class="text-[11px] text-gray-400">
              Bs {{ (subtotal * exchangeRate).toFixed(2) }}
            </p>
          </div>
        </div>
        <div
          v-if="storeInfo?.deliveryEnabled"
          class="flex justify-between text-sm text-gray-600"
        >
          <span>Delivery</span>
          <span class="font-semibold">
            {{ deliveryFee > 0 ? `$${deliveryFee.toFixed(2)}` : "Gratis" }}
          </span>
        </div>
        <div class="border-t border-gray-100 pt-2.5 dark:border-gray-800">
          <div class="flex justify-between text-base font-bold text-gray-900 dark:text-white">
            <span>Total</span>
            <div class="text-right">
              <span class="text-lg">${{ total.toFixed(2) }}</span>
              <p v-if="exchangeRate" class="text-xs font-medium text-gray-400">
                Bs {{ (total * exchangeRate).toFixed(2) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Minimum order warning -->
      <p
        v-if="!meetsMinimum && storeInfo?.minOrderAmount"
        class="mt-3 text-center text-xs font-medium text-amber-600"
      >
        Pedido minimo: ${{ storeInfo.minOrderAmount.toFixed(2) }}
      </p>

      <!-- Checkout button -->
      <NuxtLink
        to="/tienda/checkout"
        class="mt-4 block w-full rounded-2xl py-3.5 text-center text-sm font-bold transition-all active:scale-[0.98]"
        :class="
          meetsMinimum
            ? 'bg-gray-900 text-white shadow-md hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
            : 'pointer-events-none bg-gray-200 text-gray-400 dark:bg-white/5 dark:text-gray-600'
        "
      >
        Continuar al pago
      </NuxtLink>
    </template>
  </div>
</template>
