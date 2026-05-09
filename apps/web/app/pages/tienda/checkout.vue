<script setup lang="ts">
/**
 * Storefront checkout page.
 *
 * Collects customer info (name, phone), shows payment methods
 * from the seller's store settings, and submits the order.
 * On success, generates a wa.me link and redirects to WhatsApp.
 *
 * Connected to: POST /catalog/:slug/orders
 */

definePageMeta({ layout: "storefront" });

const config = useRuntimeConfig();
const apiBase = config.public.apiBase as string;
const { tenantSlug } = useTenant();
const { items, subtotal, itemCount, clear } = useCart();
const { storeInfo, business, exchangeRate } = useStorefront();

useStorefrontSeo({ title: "Checkout" });

// Redirect to cart if empty
if (itemCount.value === 0) {
  navigateTo("/tienda/cart");
}

// Form state
const customerName = ref("");
const customerPhone = ref("");
const customerNotes = ref("");
const selectedPaymentMethod = ref("");
const paymentReference = ref("");
const deliveryRequested = ref(false);

// Submission state
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);

// Idempotency key: generated once per checkout session, reused on retries
const idempotencyKey = ref(import.meta.client ? crypto.randomUUID() : "");

/** Delivery fee. */
const deliveryFee = computed(() => {
  if (!deliveryRequested.value || !storeInfo.value?.deliveryEnabled) return 0;
  return storeInfo.value.deliveryFee;
});

/** Total. */
const total = computed(() => subtotal.value + deliveryFee.value);

/** Form validation. */
const isFormValid = computed(() => {
  return (
    customerName.value.trim().length >= 2 &&
    customerPhone.value.trim().length >= 7 &&
    selectedPaymentMethod.value.length > 0
  );
});

/** Submit the order to the API. */
async function submitOrder() {
  if (!isFormValid.value || isSubmitting.value) return;

  isSubmitting.value = true;
  submitError.value = null;

  try {
    const orderItems = items.value.map((item) => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      lineTotal: item.price * item.quantity,
    }));

    const response = await $fetch<{
      orderId: string;
      waLink: string | null;
    }>(`${apiBase}/catalog/${tenantSlug.value}/orders`, {
      method: "POST",
      body: {
        customerName: customerName.value.trim(),
        customerPhone: customerPhone.value.trim(),
        customerNotes: customerNotes.value.trim() || undefined,
        items: orderItems,
        paymentMethod: selectedPaymentMethod.value,
        paymentReference: paymentReference.value.trim() || undefined,
        deliveryRequested: deliveryRequested.value,
        idempotencyKey: idempotencyKey.value || undefined,
      },
    });

    // Clear cart after successful order
    clear();

    // Redirect to WhatsApp if link available, otherwise to confirmation
    if (response.waLink && import.meta.client) {
      // Navigate to confirmation page first, then open WhatsApp
      await navigateTo(`/tienda/order/${response.orderId}`);
      window.open(response.waLink, "_blank");
    } else {
      await navigateTo(`/tienda/order/${response.orderId}`);
    }
  } catch (err) {
    const fetchError = err as {
      data?: { error?: string; details?: string[] };
    };
    submitError.value =
      fetchError.data?.error ?? "Error al enviar el pedido. Intenta de nuevo.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div>
    <!-- Back link -->
    <NuxtLink
      to="/tienda/cart"
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
      Volver al carrito
    </NuxtLink>

    <h1 class="mb-5 text-xl font-bold text-gray-900">Confirmar pedido</h1>

    <!-- Order summary -->
    <div class="mb-5 rounded-2xl border border-gray-100 bg-white p-4">
      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Resumen
      </p>
      <div class="space-y-1.5">
        <div
          v-for="item in items"
          :key="item.productId"
          class="flex justify-between text-sm"
        >
          <span class="text-gray-700">
            {{ item.name }}
            <span class="text-gray-400">x{{ item.quantity }}</span>
          </span>
          <div class="text-right">
            <span class="font-semibold text-gray-900">
              ${{ (item.price * item.quantity).toFixed(2) }}
            </span>
            <p
              v-if="exchangeRate"
              class="text-[11px] text-gray-400"
            >
              Bs. {{ (item.price * item.quantity * exchangeRate).toFixed(2) }}
            </p>
          </div>
        </div>
      </div>
      <div class="mt-3 border-t border-gray-100 pt-2">
        <div class="flex justify-between text-sm">
          <span class="text-gray-600">Subtotal</span>
          <div class="text-right">
            <span class="font-semibold">${{ subtotal.toFixed(2) }}</span>
            <p v-if="exchangeRate" class="text-[11px] text-gray-400">
              Bs. {{ (subtotal * exchangeRate).toFixed(2) }}
            </p>
          </div>
        </div>
        <div
          v-if="deliveryRequested && deliveryFee > 0"
          class="flex justify-between text-sm"
        >
          <span class="text-gray-600">Delivery</span>
          <span class="font-semibold">${{ deliveryFee.toFixed(2) }}</span>
        </div>
        <div class="mt-1 flex justify-between text-base font-bold text-gray-900">
          <span>Total</span>
          <div class="text-right">
            <span>${{ total.toFixed(2) }}</span>
            <p v-if="exchangeRate" class="text-xs font-medium text-gray-400">
              Bs. {{ (total * exchangeRate).toFixed(2) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Customer info form -->
    <div class="space-y-4">
      <div>
        <label class="mb-1.5 block text-sm font-semibold text-gray-700">
          Tu nombre *
        </label>
        <input
          v-model="customerName"
          type="text"
          placeholder="Nombre completo"
          class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
        >
      </div>

      <div>
        <label class="mb-1.5 block text-sm font-semibold text-gray-700">
          Tu telefono *
        </label>
        <input
          v-model="customerPhone"
          type="tel"
          placeholder="0412-1234567"
          class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
        >
      </div>

      <div>
        <label class="mb-1.5 block text-sm font-semibold text-gray-700">
          Nota (opcional)
        </label>
        <textarea
          v-model="customerNotes"
          rows="2"
          placeholder="Instrucciones especiales, direccion, etc."
          class="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
        />
      </div>

      <!-- Delivery option -->
      <div
        v-if="storeInfo?.deliveryEnabled"
        class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
      >
        <input
          id="delivery-check"
          v-model="deliveryRequested"
          type="checkbox"
          class="h-4 w-4 rounded border-gray-300 text-gray-900"
        >
        <label for="delivery-check" class="text-sm text-gray-700">
          Solicitar delivery
          <span v-if="storeInfo.deliveryFee > 0" class="text-gray-400">
            (+${{ storeInfo.deliveryFee.toFixed(2) }})
          </span>
          <span v-else class="text-green-600 font-medium">Gratis</span>
        </label>
      </div>

      <!-- Delivery zones info -->
      <p
        v-if="deliveryRequested && storeInfo?.deliveryZones"
        class="text-xs text-gray-500"
      >
        Zonas de delivery: {{ storeInfo.deliveryZones }}
      </p>

      <!-- Payment method selection -->
      <div>
        <p class="mb-2 text-sm font-semibold text-gray-700">
          Metodo de pago *
        </p>

        <!-- No payment methods configured -->
        <div
          v-if="!storeInfo?.paymentMethods?.length"
          class="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-4 text-center"
        >
          <p class="text-sm font-medium text-amber-700">
            El vendedor no ha configurado metodos de pago.
          </p>
          <p class="mt-1 text-xs text-amber-600">
            Contactalo por WhatsApp para coordinar el pago.
          </p>
        </div>

        <div v-else class="space-y-2">
          <label
            v-for="pm in storeInfo?.paymentMethods ?? []"
            :key="pm.method"
            class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors"
            :class="
              selectedPaymentMethod === pm.method
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            "
          >
            <input
              v-model="selectedPaymentMethod"
              type="radio"
              :value="pm.method"
              class="mt-0.5 h-4 w-4 border-gray-300 text-gray-900"
            >
            <div>
              <p class="text-sm font-semibold text-gray-900">{{ pm.label }}</p>
              <!-- Payment details (bank, phone, CI, etc.) -->
              <div class="mt-1 space-y-0.5">
                <p
                  v-for="(value, key) in pm.details"
                  :key="key"
                  class="text-xs text-gray-500"
                >
                  <span class="font-medium capitalize text-gray-600">{{ key }}:</span>
                  {{ value }}
                </p>
              </div>
            </div>
          </label>
        </div>
      </div>

      <!-- Payment reference -->
      <div v-if="selectedPaymentMethod">
        <label class="mb-1.5 block text-sm font-semibold text-gray-700">
          Referencia de pago (opcional)
        </label>
        <input
          v-model="paymentReference"
          type="text"
          placeholder="Nro. de transferencia o referencia"
          class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
        >
      </div>

      <!-- Error message -->
      <p v-if="submitError" class="text-sm font-medium text-red-600">
        {{ submitError }}
      </p>

      <!-- Submit button -->
      <button
        class="w-full rounded-xl py-3.5 text-sm font-bold transition-colors"
        :class="
          isFormValid && !isSubmitting
            ? 'bg-gray-900 text-white hover:bg-gray-800'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        "
        :disabled="!isFormValid || isSubmitting"
        @click="submitOrder"
      >
        {{ isSubmitting ? "Enviando pedido..." : "Confirmar pedido" }}
      </button>

      <!-- WhatsApp note -->
      <p
        v-if="business?.whatsappNumber"
        class="text-center text-xs text-gray-400"
      >
        Al confirmar, se abrira WhatsApp para contactar al vendedor.
      </p>
    </div>
  </div>
</template>
