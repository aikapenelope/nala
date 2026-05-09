<script setup lang="ts">
/**
 * Storefront cart page.
 *
 * Shows cart items with quantity controls, subtotal,
 * and a button to proceed to checkout.
 */

definePageMeta({ layout: "storefront" });

const { items, removeItem, updateQuantity, itemCount, subtotal, clear } =
  useCart();
const { storeInfo } = useStorefront();

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
  <div>
    <!-- Back link -->
    <NuxtLink
      to="/tienda"
      class="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
    >
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
      >
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
      </svg>
      Seguir comprando
    </NuxtLink>

    <h1 class="mb-5 text-xl font-bold text-gray-900">Tu carrito</h1>

    <!-- Empty cart -->
    <div v-if="itemCount === 0" class="py-16 text-center">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-gray-400"
        >
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
      </div>
      <p class="text-base font-medium text-gray-600">Tu carrito esta vacio</p>
      <p class="mt-1 text-sm text-gray-400">
        Agrega productos desde el catalogo.
      </p>
      <NuxtLink
        to="/tienda"
        class="mt-5 inline-block rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white"
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
          class="flex gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
        >
          <!-- Product image -->
          <div
            class="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100"
          >
            <img
              v-if="item.imageUrl"
              :src="item.imageUrl"
              :alt="item.name"
              class="h-full w-full object-cover"
            >
            <div
              v-else
              class="flex h-full w-full items-center justify-center text-gray-300"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
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
          </div>

          <!-- Item details -->
          <div class="flex min-w-0 flex-1 flex-col justify-between">
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm font-semibold leading-tight text-gray-900">
                {{ item.name }}
              </p>
              <button
                class="flex-shrink-0 text-gray-400 hover:text-red-500"
                aria-label="Eliminar"
                @click="removeItem(item.productId)"
              >
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
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div class="mt-1 flex items-center justify-between">
              <!-- Quantity controls -->
              <div class="flex items-center gap-2">
                <button
                  class="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200"
                  @click="updateQuantity(item.productId, item.quantity - 1)"
                >
                  -
                </button>
                <span class="min-w-[20px] text-center text-sm font-bold text-gray-900">
                  {{ item.quantity }}
                </span>
                <button
                  class="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200"
                  @click="updateQuantity(item.productId, item.quantity + 1)"
                >
                  +
                </button>
              </div>

              <!-- Line total -->
              <p class="text-sm font-bold text-gray-900">
                ${{ (item.price * item.quantity).toFixed(2) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Clear cart -->
      <button
        class="mt-4 text-xs font-medium text-gray-400 underline hover:text-gray-600"
        @click="clear"
      >
        Vaciar carrito
      </button>

      <!-- Summary -->
      <div class="mt-6 space-y-2 rounded-2xl border border-gray-100 bg-white p-4">
        <div class="flex justify-between text-sm text-gray-600">
          <span>Subtotal ({{ itemCount }} items)</span>
          <span class="font-semibold">${{ subtotal.toFixed(2) }}</span>
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
        <div class="border-t border-gray-100 pt-2">
          <div class="flex justify-between text-base font-bold text-gray-900">
            <span>Total</span>
            <span>${{ total.toFixed(2) }}</span>
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
        class="mt-4 block w-full rounded-xl py-3.5 text-center text-sm font-bold transition-colors"
        :class="
          meetsMinimum
            ? 'bg-gray-900 text-white hover:bg-gray-800'
            : 'pointer-events-none bg-gray-200 text-gray-400'
        "
      >
        Continuar al pago
      </NuxtLink>
    </template>
  </div>
</template>
