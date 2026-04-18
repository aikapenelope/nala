<script setup lang="ts">
/**
 * Checkout page - payment method selection and sale confirmation.
 *
 * Flow:
 * 1. Reads ticket items from sessionStorage (set by POS screen)
 * 2. Fetches exchange rate from GET /api/exchange-rate
 * 3. Fetches available surcharge types from GET /api/surcharge-types
 * 4. User selects payment method, channel, and optional surcharges
 * 5. If fiado: must select a customer
 * 6. Confirm:
 *    - Online: POST /api/sales -> receipt option
 *    - Offline: queue in IndexedDB -> sync when connectivity returns
 *
 * Connected to:
 * - GET /api/exchange-rate
 * - GET /api/surcharge-types
 * - POST /api/sales
 * - useOfflineQueue (IndexedDB fallback)
 */

import { usdToBs } from "@nova/shared";
import type { PaymentMethod, SaleChannel } from "@nova/shared";

const router = useRouter();
const { $api } = useApi();
const { user } = useNovaAuth();
const { isOnline, queueSale, init: initOfflineQueue } = useOfflineQueue();

/** Exchange rate from API. */
const exchangeRate = ref(0);
const rateError = ref("");

/** Ticket items from POS screen. */
interface CheckoutItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

const items = ref<CheckoutItem[]>([]);
const subtotalUsd = ref(0);

const selectedMethod = ref<PaymentMethod | null>(null);
const reference = ref("");
const selectedCustomerId = ref<string | null>(null);
const isSubmitting = ref(false);
const saleComplete = ref(false);
const saleError = ref("");

/** Whether the sale was queued offline (not sent to server yet). */
const queuedOffline = ref(false);

/** Sale channel (defaults to POS). */
const selectedChannel = ref<SaleChannel>("pos");

/** Channel display info. */
const channelOptions: Array<{ value: SaleChannel; label: string }> = [
  { value: "pos", label: "POS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "delivery", label: "Delivery" },
  { value: "online", label: "Online" },
];

/** Available surcharge types from API. */
interface SurchargeType {
  id: string;
  name: string;
  defaultAmount: string | null;
}
const surchargeTypes = ref<SurchargeType[]>([]);

/** Surcharges applied to this sale. */
interface AppliedSurcharge {
  name: string;
  amount: number;
}
const appliedSurcharges = ref<AppliedSurcharge[]>([]);

/** Total surcharges amount. */
const surchargesTotal = computed(() =>
  appliedSurcharges.value.reduce((sum, s) => sum + s.amount, 0),
);

/** Grand total including surcharges. */
const totalUsd = computed(() =>
  Math.round((subtotalUsd.value + surchargesTotal.value) * 100) / 100,
);

/** Total in Bs. */
const totalBs = computed(() =>
  exchangeRate.value > 0 ? usdToBs(totalUsd.value, exchangeRate.value) : 0,
);

/** Add a surcharge from the available types. */
function addSurcharge(st: SurchargeType) {
  // Don't add duplicates
  if (appliedSurcharges.value.some((s) => s.name === st.name)) return;
  appliedSurcharges.value.push({
    name: st.name,
    amount: Number(st.defaultAmount ?? 0),
  });
}

/** Remove a surcharge by index. */
function removeSurcharge(index: number) {
  appliedSurcharges.value.splice(index, 1);
}

/** Load ticket data, exchange rate, and surcharge types on mount. */
onMounted(async () => {
  if (!import.meta.client) return;

  // Initialize offline queue listeners
  await initOfflineQueue();

  // Read ticket from sessionStorage
  const storedItems = sessionStorage.getItem("nova:checkout:items");
  const storedTotal = sessionStorage.getItem("nova:checkout:total");

  if (!storedItems || !storedTotal) {
    // No ticket data -- redirect back to POS
    router.push("/sales");
    return;
  }

  try {
    items.value = JSON.parse(storedItems);
    subtotalUsd.value = Number(storedTotal);
  } catch {
    router.push("/sales");
    return;
  }

  // Fetch exchange rate
  try {
    const rate = await $api<{ rateBcv: number }>("/api/exchange-rate");
    exchangeRate.value = rate.rateBcv;
  } catch {
    rateError.value =
      "Tasa de cambio no disponible. Las ventas se registran solo en USD.";
  }

  // Fetch available surcharge types
  try {
    const result = await $api<{
      surchargeTypes: SurchargeType[];
    }>("/api/surcharge-types");
    surchargeTypes.value = result.surchargeTypes;
  } catch {
    // Non-critical: surcharge section won't show
  }
});

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
    label: "Pago Movil",
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
  if (items.value.length === 0) return false;
  return true;
});

/** Submit the sale to the API, or queue offline if no connectivity. */
async function confirmSale() {
  if (!canSubmit.value || !selectedMethod.value) return;

  isSubmitting.value = true;
  saleError.value = "";

  // Offline path: queue in IndexedDB for later sync
  if (!isOnline.value) {
    try {
      await queueSale({
        items: items.value.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.unitPrice,
          discount: item.discountPercent,
        })),
        total: totalUsd.value,
        paymentMethod: selectedMethod.value,
        customerId: selectedCustomerId.value ?? undefined,
        userId: user.value?.id ?? "",
        createdAt: new Date().toISOString(),
      });

      sessionStorage.removeItem("nova:checkout:items");
      sessionStorage.removeItem("nova:checkout:total");

      queuedOffline.value = true;
      saleComplete.value = true;
    } catch {
      saleError.value =
        "Error guardando la venta localmente. Intenta de nuevo.";
    } finally {
      isSubmitting.value = false;
    }
    return;
  }

  // Online path: POST to API
  try {
    await $api("/api/sales", {
      method: "POST",
      body: {
        items: items.value.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
        })),
        payments: [
          {
            method: selectedMethod.value,
            amountUsd: totalUsd.value,
            reference: reference.value || undefined,
          },
        ],
        customerId: selectedCustomerId.value || undefined,
        discountPercent: 0,
        discountAmount: 0,
        surcharges: appliedSurcharges.value.map((s) => ({
          name: s.name,
          amount: s.amount,
        })),
        channel: selectedChannel.value,
      },
    });

    // Clear ticket from sessionStorage
    sessionStorage.removeItem("nova:checkout:items");
    sessionStorage.removeItem("nova:checkout:total");

    saleComplete.value = true;
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    saleError.value = fetchError.data?.error ?? "Error al registrar la venta";
  } finally {
    isSubmitting.value = false;
  }
}

/** Send receipt via WhatsApp (wa.me link). */
function sendWhatsAppReceipt() {
  const bsText =
    exchangeRate.value > 0 ? ` (Bs.${totalBs.value.toFixed(2)})` : "";
  const text = encodeURIComponent(
    `Recibo Nova\nTotal: $${totalUsd.value.toFixed(2)}${bsText}\nMetodo: ${selectedMethod.value}\nGracias por su compra!`,
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
      <div class="mb-4 text-5xl">{{ queuedOffline ? "📡" : "✓" }}</div>
      <h1 class="text-2xl font-bold text-gray-900">
        {{ queuedOffline ? "Venta guardada" : "Venta registrada" }}
      </h1>
      <p class="mt-2 text-lg text-gray-500">
        ${{ totalUsd.toFixed(2) }}
        <span v-if="exchangeRate > 0" class="text-sm">
          (Bs.{{ totalBs.toFixed(2) }})
        </span>
      </p>
      <p
        v-if="queuedOffline"
        class="mt-3 rounded-lg bg-yellow-50 px-4 py-2 text-sm text-yellow-700"
      >
        Sin conexion. La venta se sincronizara automaticamente cuando vuelva el
        internet.
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
        <p
          v-if="surchargesTotal > 0"
          class="mt-1 text-xs text-gray-400"
        >
          Subtotal ${{ subtotalUsd.toFixed(2) }} + cargos
          ${{ surchargesTotal.toFixed(2) }}
        </p>
        <p v-if="exchangeRate > 0" class="mt-1 text-sm text-gray-400">
          Bs.{{ totalBs.toFixed(2) }} · Tasa {{ exchangeRate.toFixed(2) }}
        </p>
        <p v-if="rateError" class="mt-1 text-xs text-yellow-600">
          {{ rateError }}
        </p>
      </div>

      <!-- Sale channel selector -->
      <div class="mb-4">
        <p class="mb-2 text-sm font-semibold text-gray-700">Canal de venta</p>
        <div class="flex gap-2">
          <button
            v-for="ch in channelOptions"
            :key="ch.value"
            class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
            :class="
              selectedChannel === ch.value
                ? 'border-nova-primary bg-blue-50 text-nova-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            "
            @click="selectedChannel = ch.value"
          >
            {{ ch.label }}
          </button>
        </div>
      </div>

      <!-- Surcharges -->
      <div v-if="surchargeTypes.length > 0" class="mb-4">
        <p class="mb-2 text-sm font-semibold text-gray-700">
          Cargos adicionales
        </p>

        <!-- Available surcharge types -->
        <div class="mb-2 flex flex-wrap gap-2">
          <button
            v-for="st in surchargeTypes"
            :key="st.id"
            class="rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-600 transition-colors hover:border-nova-primary hover:text-nova-primary"
            :class="{
              'opacity-40': appliedSurcharges.some((s) => s.name === st.name),
            }"
            :disabled="appliedSurcharges.some((s) => s.name === st.name)"
            @click="addSurcharge(st)"
          >
            + {{ st.name }}
          </button>
        </div>

        <!-- Applied surcharges with editable amounts -->
        <div v-if="appliedSurcharges.length > 0" class="space-y-2">
          <div
            v-for="(surcharge, idx) in appliedSurcharges"
            :key="idx"
            class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
          >
            <span class="flex-1 text-sm text-gray-700">
              {{ surcharge.name }}
            </span>
            <span class="text-xs text-gray-400">$</span>
            <input
              v-model.number="surcharge.amount"
              type="number"
              step="0.01"
              min="0"
              class="w-20 rounded border border-gray-200 px-2 py-1 text-right text-sm focus:border-nova-primary focus:outline-none"
            >
            <button
              class="text-xs text-red-400 hover:text-red-600"
              @click="removeSurcharge(idx)"
            >
              x
            </button>
          </div>
        </div>
      </div>

      <!-- Payment method selector -->
      <div class="mb-4">
        <p class="mb-3 text-sm font-semibold text-gray-700">Metodo de pago</p>
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
          placeholder="Numero de referencia"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
        >
      </div>

      <!-- Customer selector (for fiado) -->
      <div v-if="isFiado" class="mb-4 rounded-xl bg-yellow-50 p-4">
        <p class="mb-2 text-sm font-medium text-yellow-800">
          Fiado requiere seleccionar un cliente
        </p>
        <input
          v-model="selectedCustomerId"
          type="text"
          placeholder="ID del cliente..."
          class="w-full rounded-lg border border-yellow-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none"
        >
        <p class="mt-1 text-xs text-yellow-600">
          Se generara una cuenta por cobrar automaticamente
        </p>
      </div>

      <!-- Offline indicator -->
      <div
        v-if="!isOnline"
        class="mb-4 flex items-center gap-2 rounded-lg bg-yellow-50 px-4 py-2 text-sm text-yellow-700"
      >
        <span class="h-2 w-2 rounded-full bg-yellow-500" />
        Sin conexion. La venta se guardara localmente.
      </div>

      <!-- Error -->
      <p v-if="saleError" class="mb-4 text-sm text-red-500">
        {{ saleError }}
      </p>

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
