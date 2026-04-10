<script setup lang="ts">
/**
 * Checkout page - payment method selection and sale confirmation.
 *
 * Flow:
 * 1. Shows sale total in USD and Bs. (BCV rate)
 * 2. User selects payment method (7 methods with large icons)
 * 3. If fiado: must select a customer
 * 4. Confirm → sale registered → receipt option
 *
 * 7 payment methods for Venezuela:
 * Efectivo, Pago Móvil, Binance, Zinli, Transferencia, Zelle, Fiado
 */

import { usdToBs } from "@nova/shared";
import type { PaymentMethod } from "@nova/shared";

const router = useRouter();

/** Mock exchange rate. Will come from API in production. */
const exchangeRate = ref(36.5);

/** Sale total passed from the POS screen (via query or state). */
const totalUsd = ref(15.5);

const selectedMethod = ref<PaymentMethod | null>(null);
const reference = ref("");
const selectedCustomerId = ref<string | null>(null);
const isSubmitting = ref(false);
const saleComplete = ref(false);

/** Total in Bs. */
const totalBs = computed(() => usdToBs(totalUsd.value, exchangeRate.value));

/** Payment methods with display info. */
const paymentMethods: Array<{
  value: PaymentMethod;
  label: string;
  icon: string;
  needsReference: boolean;
}> = [
  { value: "efectivo", label: "Efectivo", icon: "💵", needsReference: false },
  {
    value: "pago_movil",
    label: "Pago Móvil",
    icon: "📱",
    needsReference: true,
  },
  { value: "binance", label: "Binance", icon: "🪙", needsReference: true },
  { value: "zinli", label: "Zinli", icon: "💳", needsReference: true },
  {
    value: "transferencia",
    label: "Transferencia",
    icon: "🏦",
    needsReference: true,
  },
  { value: "zelle", label: "Zelle", icon: "💸", needsReference: true },
  { value: "fiado", label: "Fiado", icon: "📝", needsReference: false },
];

/** Whether the selected method needs a reference number. */
const needsReference = computed(() => {
  if (!selectedMethod.value) return false;
  return (
    paymentMethods.find((m) => m.value === selectedMethod.value)
      ?.needsReference ?? false
  );
});

/** Whether fiado is selected (requires customer). */
const isFiado = computed(() => selectedMethod.value === "fiado");

/** Can submit the sale. */
const canSubmit = computed(() => {
  if (!selectedMethod.value) return false;
  if (isFiado.value && !selectedCustomerId.value) return false;
  return true;
});

/** Submit the sale. */
async function confirmSale() {
  if (!canSubmit.value || !selectedMethod.value) return;

  isSubmitting.value = true;

  try {
    // TODO: Call POST /api/sales with items from POS screen state
    // For now, simulate success
    await new Promise((resolve) => setTimeout(resolve, 800));
    saleComplete.value = true;
  } catch {
    // Error handling
  } finally {
    isSubmitting.value = false;
  }
}

/** Send receipt via WhatsApp (wa.me link). */
function sendWhatsAppReceipt() {
  const text = encodeURIComponent(
    `Recibo Nova\nTotal: $${totalUsd.value.toFixed(2)} (Bs.${totalBs.value.toFixed(2)})\nMétodo: ${selectedMethod.value}\nGracias por su compra!`,
  );
  window.open(`https://wa.me/?text=${text}`, "_blank");
}

/** Go back to POS screen for next sale. */
function newSale() {
  router.push("/sales");
}
</script>

<template>
  <div class="mx-auto max-w-md">
    <!-- Sale complete screen -->
    <div v-if="saleComplete" class="py-12 text-center">
      <div class="mb-4 text-5xl">✓</div>
      <h1 class="text-2xl font-bold text-gray-900">Venta registrada</h1>
      <p class="mt-2 text-lg text-gray-500">
        ${{ totalUsd.toFixed(2) }}
        <span class="text-sm">(Bs.{{ totalBs.toFixed(2) }})</span>
      </p>

      <div class="mt-8 space-y-3">
        <button
          class="w-full rounded-xl bg-green-600 py-3 font-medium text-white"
          @click="sendWhatsAppReceipt"
        >
          Enviar recibo por WhatsApp
        </button>
        <button
          class="w-full rounded-xl bg-nova-primary py-3 font-medium text-white"
          @click="newSale"
        >
          Nueva venta
        </button>
      </div>
    </div>

    <!-- Checkout form -->
    <template v-else>
      <!-- Total display -->
      <div class="mb-6 rounded-xl bg-white p-6 text-center shadow-sm">
        <p class="text-sm text-gray-500">Total a cobrar</p>
        <p class="text-4xl font-bold text-gray-900">
          ${{ totalUsd.toFixed(2) }}
        </p>
        <p class="mt-1 text-sm text-gray-400">
          Bs.{{ totalBs.toFixed(2) }} · Tasa {{ exchangeRate.toFixed(2) }}
        </p>
      </div>

      <!-- Payment method selector -->
      <div class="mb-4">
        <p class="mb-3 text-sm font-semibold text-gray-700">Método de pago</p>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="method in paymentMethods"
            :key="method.value"
            class="flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-colors"
            :class="
              selectedMethod === method.value
                ? 'border-nova-primary bg-blue-50'
                : 'border-gray-200 bg-white'
            "
            @click="selectedMethod = method.value"
          >
            <span class="text-2xl">{{ method.icon }}</span>
            <span class="text-[10px] font-medium text-gray-700">
              {{ method.label }}
            </span>
          </button>
        </div>
      </div>

      <!-- Reference number (for digital payments) -->
      <div v-if="needsReference" class="mb-4">
        <label class="mb-1 block text-sm text-gray-600">
          Referencia de pago
        </label>
        <input
          v-model="reference"
          type="text"
          placeholder="Número de referencia"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
        />
      </div>

      <!-- Customer selector (for fiado) -->
      <div v-if="isFiado" class="mb-4 rounded-xl bg-yellow-50 p-4">
        <p class="mb-2 text-sm font-medium text-yellow-800">
          Fiado requiere seleccionar un cliente
        </p>
        <!-- TODO: Customer search/select component -->
        <input
          v-model="selectedCustomerId"
          type="text"
          placeholder="Buscar cliente..."
          class="w-full rounded-lg border border-yellow-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none"
        />
        <p class="mt-1 text-xs text-yellow-600">
          Se generará una cuenta por cobrar automáticamente
        </p>
      </div>

      <!-- Confirm button -->
      <button
        class="w-full rounded-xl py-3 font-semibold text-white transition-colors disabled:opacity-50"
        :class="canSubmit ? 'bg-nova-primary' : 'bg-gray-300'"
        :disabled="!canSubmit || isSubmitting"
        @click="confirmSale"
      >
        {{
          isSubmitting ? "Registrando..." : `Confirmar $${totalUsd.toFixed(2)}`
        }}
      </button>

      <!-- Back link -->
      <NuxtLink
        to="/sales"
        class="mt-4 block text-center text-sm text-gray-500 hover:text-gray-700"
      >
        Volver al ticket
      </NuxtLink>
    </template>
  </div>
</template>
