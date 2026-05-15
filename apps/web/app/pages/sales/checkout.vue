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
 */

import { usdToBs } from "@nova/shared";
import type { PaymentMethod, SaleChannel } from "@nova/shared";
import { Check, WifiOff, X, ShoppingCart, Share2 } from "lucide-vue-next";
import { shareReceipt } from "~/composables/useReceiptImage";
import type { ReceiptData } from "~/composables/useReceiptImage";

const router = useRouter();
const { $api } = useApi();
const { user } = useNovaAuth();

/** Simple online status check (no IndexedDB dependency). */
const isOnline = ref(true);

function updateOnlineStatus() {
  if (import.meta.client) {
    isOnline.value = navigator.onLine;
  }
}

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
const fiadoDueDate = ref("");

// ============================================================
// Customer search for fiado
// ============================================================

interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
  balanceUsd: string;
}

const customerQuery = ref("");
const customerResults = ref<CustomerOption[]>([]);
const selectedCustomerName = ref("");
const isSearchingCustomers = ref(false);
const showCustomerDropdown = ref(false);
let customerSearchTimer: ReturnType<typeof setTimeout> | null = null;

/** Search customers as the user types (debounced). */
function onCustomerInput() {
  selectedCustomerId.value = null;
  selectedCustomerName.value = "";
  if (customerSearchTimer) clearTimeout(customerSearchTimer);

  const q = customerQuery.value.trim();
  if (q.length < 2) {
    customerResults.value = [];
    showCustomerDropdown.value = false;
    return;
  }

  customerSearchTimer = setTimeout(async () => {
    isSearchingCustomers.value = true;
    try {
      const result = await $api<{ customers: CustomerOption[] }>(
        `/api/customers?search=${encodeURIComponent(q)}&limit=5`,
      );
      customerResults.value = result.customers;
      showCustomerDropdown.value = result.customers.length > 0;
    } catch {
      customerResults.value = [];
    } finally {
      isSearchingCustomers.value = false;
    }
  }, 250);
}

/** Select a customer from the dropdown. */
function selectCustomer(c: CustomerOption) {
  selectedCustomerId.value = c.id;
  selectedCustomerName.value = c.name;
  customerQuery.value = c.name;
  showCustomerDropdown.value = false;
}

/** Clear customer selection. */
function clearCustomer() {
  selectedCustomerId.value = null;
  selectedCustomerName.value = "";
  customerQuery.value = "";
  customerResults.value = [];
  showCustomerDropdown.value = false;
}
const isSubmitting = ref(false);
const saleComplete = ref(false);
const saleError = ref("");

/**
 * IGTF (Impuesto a las Grandes Transacciones Financieras) - 3%.
 * Applies to payments in foreign currency (USD cash, Zelle, Binance, Zinli).
 * Same logic as the storefront checkout for consistency.
 */
const IGTF_RATE = 0.03;
const IGTF_NAME = "IGTF (3%)";
const divisaMethods = new Set<PaymentMethod>(["efectivo", "zelle", "binance", "zinli"]);

const isIgtfApplicable = computed(() => {
  return selectedMethod.value !== null && divisaMethods.has(selectedMethod.value);
});

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

/** Total surcharges amount (includes IGTF when applicable). */
const surchargesTotal = computed(() =>
  appliedSurcharges.value.reduce((sum, s) => sum + s.amount, 0),
);

/** Grand total including surcharges and IGTF. */
const totalUsd = computed(() =>
  Math.round((subtotalUsd.value + surchargesTotal.value) * 100) / 100,
);

/**
 * Auto-manage IGTF surcharge when payment method changes.
 * Adds IGTF as a surcharge for divisa methods, removes it otherwise.
 * The IGTF amount is calculated on the subtotal + other surcharges (excluding IGTF itself).
 */
watch(
  [selectedMethod, subtotalUsd],
  () => {
    // Remove any existing IGTF surcharge first
    const igtfIdx = appliedSurcharges.value.findIndex((s) => s.name === IGTF_NAME);
    if (igtfIdx !== -1) {
      appliedSurcharges.value.splice(igtfIdx, 1);
    }

    // Add IGTF if applicable
    if (isIgtfApplicable.value) {
      const baseForIgtf =
        subtotalUsd.value +
        appliedSurcharges.value.reduce((sum, s) => sum + s.amount, 0);
      const igtfAmount = Math.round(baseForIgtf * IGTF_RATE * 100) / 100;
      if (igtfAmount > 0) {
        appliedSurcharges.value.push({ name: IGTF_NAME, amount: igtfAmount });
      }
    }
  },
  { immediate: false },
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

  // Track online status
  updateOnlineStatus();
  window.addEventListener("online", () => { isOnline.value = true; });
  window.addEventListener("offline", () => { isOnline.value = false; });

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

  // Block sale when offline -- require connectivity
  if (!isOnline.value) {
    saleError.value = "Sin conexion a internet. Verifica tu conexion e intenta de nuevo.";
    isSubmitting.value = false;
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
        fiadoDueDate: fiadoDueDate.value || undefined,
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

/** Build receipt data for the unified receipt composable. */
function buildReceiptData(): ReceiptData {
  const methodLabel =
    paymentMethods.find((m) => m.value === selectedMethod.value)?.label ??
    (selectedMethod.value ?? "");

  return {
    businessName: user.value?.businessName ?? "Mi Negocio",
    items: items.value.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.unitPrice * item.quantity,
    })),
    subtotal: subtotalUsd.value,
    surcharges: appliedSurcharges.value.length > 0
      ? appliedSurcharges.value
      : undefined,
    totalUsd: totalUsd.value,
    totalBs: exchangeRate.value > 0 ? totalBs.value : undefined,
    exchangeRate: exchangeRate.value > 0 ? exchangeRate.value : undefined,
    paymentMethod: methodLabel,
    date: new Date(),
  };
}

const isSharing = ref(false);

/** Share receipt as image via WhatsApp (with text fallback). */
async function handleShareReceipt() {
  isSharing.value = true;
  try {
    await shareReceipt(buildReceiptData());
  } finally {
    isSharing.value = false;
  }
}

/** Go back to POS screen for next sale. */
function newSale() {
  router.push("/sales");
}
</script>

<template>
  <div class="mx-auto max-w-md">
    <!-- Sale complete screen -->
    <div v-if="saleComplete" class="py-8 text-center">
      <div
        class="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-[#D1FAE5] to-[#6EE7B7]"
      >
        <Check :size="32" class="text-green-700" />
      </div>
      <h1 class="text-2xl font-extrabold tracking-tight text-gradient">
        Venta registrada
      </h1>
      <p class="mt-2 text-lg font-bold text-gray-600">
        ${{ totalUsd.toFixed(2) }}
        <span v-if="exchangeRate > 0" class="text-sm font-medium text-gray-400">
          (Bs.{{ totalBs.toFixed(2) }})
        </span>
      </p>

      <div class="mt-8 space-y-3">
        <button
          class="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-3.5 font-bold text-white transition-spring disabled:opacity-50"
          :disabled="isSharing"
          @click="handleShareReceipt"
        >
          <Share2 :size="18" />
          {{ isSharing ? "Preparando..." : "Enviar recibo por WhatsApp" }}
        </button>
        <button
          class="dark-pill flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-bold transition-spring"
          @click="newSale"
        >
          <ShoppingCart :size="18" />
          Nueva venta
        </button>
      </div>
    </div>

    <!-- Checkout form -->
    <template v-else>
      <!-- Total display -->
      <div class="card-premium mb-6 p-6 text-center">
        <p class="text-[13px] font-bold text-gray-500">Total a cobrar</p>
        <p class="mt-1 text-4xl font-extrabold tracking-tighter text-gradient">
          ${{ totalUsd.toFixed(2) }}
        </p>
        <p
          v-if="surchargesTotal > 0"
          class="mt-1.5 text-xs font-medium text-gray-400"
        >
          Subtotal ${{ subtotalUsd.toFixed(2) }} + cargos
          ${{ surchargesTotal.toFixed(2) }}
        </p>
        <p v-if="exchangeRate > 0" class="mt-1 text-sm font-medium text-gray-400">
          Bs.{{ totalBs.toFixed(2) }} · Tasa {{ exchangeRate.toFixed(2) }}
        </p>
        <p v-if="rateError" class="mt-1.5 text-xs font-semibold text-yellow-600">
          {{ rateError }}
        </p>
      </div>

      <!-- Sale channel selector -->
      <div class="mb-4">
        <p class="mb-2 text-[13px] font-bold text-gray-600">Canal de venta</p>
        <div class="flex gap-2">
          <button
            v-for="ch in channelOptions"
            :key="ch.value"
            class="rounded-2xl border px-3.5 py-2 text-xs font-bold transition-spring"
            :class="
              selectedChannel === ch.value
                ? 'border-nova-accent bg-purple-50 text-nova-accent'
                : 'border-white/80 bg-white/40 text-gray-600 hover:bg-white/70'
            "
            @click="selectedChannel = ch.value"
          >
            {{ ch.label }}
          </button>
        </div>
      </div>

      <!-- Surcharges -->
      <div v-if="surchargeTypes.length > 0" class="mb-4">
        <p class="mb-2 text-[13px] font-bold text-gray-600">
          Cargos adicionales
        </p>

        <!-- Available surcharge types -->
        <div class="mb-2 flex flex-wrap gap-2">
          <button
            v-for="st in surchargeTypes"
            :key="st.id"
            class="rounded-full border border-dashed px-3 py-1.5 text-xs font-bold transition-spring"
            :class="{
              'opacity-40': appliedSurcharges.some((s) => s.name === st.name),
              'border-gray-300/80 text-gray-600 hover:border-nova-accent hover:text-nova-accent': !appliedSurcharges.some((s) => s.name === st.name),
            }"
            :disabled="appliedSurcharges.some((s) => s.name === st.name)"
            @click="addSurcharge(st)"
          >
            + {{ st.name }}
          </button>
        </div>

        <!-- Applied surcharges with editable amounts (IGTF is auto-managed, not shown here) -->
        <div v-if="appliedSurcharges.filter((s) => s.name !== IGTF_NAME).length > 0" class="space-y-2">
          <div
            v-for="(surcharge, idx) in appliedSurcharges"
            :key="idx"
            class="glass flex items-center gap-2 rounded-2xl px-4 py-2.5"
          >
            <template v-if="surcharge.name !== IGTF_NAME">
              <span class="flex-1 text-sm font-semibold text-gray-700">
                {{ surcharge.name }}
              </span>
              <span class="text-xs font-bold text-gray-400">$</span>
              <input
                v-model.number="surcharge.amount"
                type="number"
                step="0.01"
                min="0"
                class="w-20 rounded-xl border border-white bg-white/60 px-2 py-1.5 text-right text-sm font-bold text-gray-800 outline-none transition-spring focus:ring-[2px] focus:ring-nova-accent/20"
              >
              <button
                class="flex h-6 w-6 items-center justify-center rounded-lg text-gray-300 transition-spring hover:bg-red-50 hover:text-red-500"
                @click="removeSurcharge(idx)"
              >
                <X :size="12" />
              </button>
            </template>
          </div>
        </div>
      </div>

      <!-- Payment method selector -->
      <div class="mb-4">
        <p class="mb-3 text-[13px] font-bold text-gray-600">Metodo de pago</p>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="method in paymentMethods"
            :key="method.value"
            class="card-premium flex flex-col items-center gap-1.5 p-3 transition-spring"
            :class="
              selectedMethod === method.value
                ? '!border-nova-accent !bg-purple-50/80 ring-[3px] ring-nova-accent/20'
                : ''
            "
            @click="selectedMethod = method.value"
          >
            <span class="text-2xl">{{ method.icon }}</span>
            <span class="text-[10px] font-bold text-gray-700">
              {{ method.label }}
            </span>
          </button>
        </div>
      </div>

      <!-- IGTF notice (for divisa payment methods) -->
      <div
        v-if="isIgtfApplicable"
        class="mb-4 glass rounded-2xl px-4 py-3"
      >
        <p class="text-[13px] font-semibold text-amber-700">
          Este metodo incluye IGTF (3%): +${{ appliedSurcharges.find((s) => s.name === IGTF_NAME)?.amount.toFixed(2) ?? "0.00" }}
        </p>
        <p class="mt-0.5 text-[11px] font-medium text-amber-600/80">
          Impuesto a las Grandes Transacciones Financieras sobre pagos en divisas.
        </p>
      </div>

      <!-- Reference number (for digital payments) -->
      <div v-if="needsReference" class="mb-4">
        <label class="mb-1.5 block text-[13px] font-bold text-gray-600">
          Referencia de pago
        </label>
        <input
          v-model="reference"
          type="text"
          placeholder="Numero de referencia"
          class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
        >
      </div>

      <!-- Customer selector (for fiado) -->
      <div v-if="isFiado" class="mb-4 rounded-2xl bg-yellow-50/80 p-4">
        <p class="mb-2 text-[13px] font-bold text-yellow-800">
          Fiado requiere seleccionar un cliente
        </p>

        <!-- Selected customer display -->
        <div
          v-if="selectedCustomerId && selectedCustomerName"
          class="flex items-center justify-between rounded-2xl border border-green-300 bg-green-50 px-4 py-3"
        >
          <div>
            <p class="text-sm font-bold text-gray-800">{{ selectedCustomerName }}</p>
            <p class="text-[11px] font-medium text-green-700">Cliente seleccionado</p>
          </div>
          <button
            class="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-spring hover:bg-red-50 hover:text-red-500"
            @click="clearCustomer"
          >
            <X :size="14" />
          </button>
        </div>

        <!-- Customer search input -->
        <div v-else class="relative">
          <input
            v-model="customerQuery"
            type="text"
            placeholder="Buscar cliente por nombre..."
            class="w-full rounded-2xl border border-yellow-200 bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 outline-none transition-spring placeholder:text-gray-400 focus:ring-[3px] focus:ring-yellow-400/20"
            @input="onCustomerInput"
            @focus="showCustomerDropdown = customerResults.length > 0"
          >
          <div
            v-if="isSearchingCustomers"
            class="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <div class="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-yellow-500" />
          </div>

          <!-- Search results dropdown -->
          <div
            v-if="showCustomerDropdown"
            class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-2xl border border-yellow-200 bg-white shadow-lg"
          >
            <button
              v-for="c in customerResults"
              :key="c.id"
              class="flex w-full items-center justify-between px-4 py-3 text-left transition-spring hover:bg-yellow-50"
              @mousedown.prevent="selectCustomer(c)"
            >
              <div>
                <p class="text-sm font-semibold text-gray-800">{{ c.name }}</p>
                <p v-if="c.phone" class="text-[11px] text-gray-500">{{ c.phone }}</p>
              </div>
              <span
                v-if="Number(c.balanceUsd) > 0"
                class="rounded-lg bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600"
              >
                Debe ${{ Number(c.balanceUsd).toFixed(2) }}
              </span>
            </button>
          </div>

          <!-- No results hint -->
          <p
            v-if="customerQuery.length >= 2 && !isSearchingCustomers && customerResults.length === 0 && !selectedCustomerId"
            class="mt-2 text-[11px] font-medium text-yellow-600"
          >
            No se encontro cliente. <NuxtLink to="/clients/new" class="font-bold underline">Crear nuevo</NuxtLink>
          </p>
        </div>

        <p class="mt-2 text-[11px] font-medium text-yellow-600">
          Se generara una cuenta por cobrar automaticamente
        </p>
        <div class="mt-3">
          <label class="mb-1 block text-[13px] font-bold text-yellow-800">
            Fecha de cobro (opcional)
          </label>
          <input
            v-model="fiadoDueDate"
            type="date"
            class="w-full rounded-2xl border border-yellow-200 bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 outline-none transition-spring focus:ring-[3px] focus:ring-yellow-400/20"
          >
        </div>
      </div>

      <!-- Offline indicator -->
      <div
        v-if="!isOnline"
        class="mb-4 glass flex items-center gap-2.5 rounded-2xl px-4 py-3"
      >
        <WifiOff :size="14" class="text-yellow-500" />
        <span class="text-[13px] font-semibold text-yellow-700">
          Sin conexion. Necesitas internet para registrar la venta.
        </span>
      </div>

      <!-- Error -->
      <div v-if="saleError" class="mb-4 card-premium p-3">
        <p class="text-sm font-semibold text-red-500">{{ saleError }}</p>
      </div>

      <!-- Confirm button -->
      <button
        class="w-full rounded-2xl py-3.5 font-extrabold tracking-wide transition-spring disabled:opacity-50"
        :class="canSubmit ? 'dark-pill' : 'bg-gray-200 text-gray-400'"
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
        class="mt-4 block text-center text-sm font-bold text-gray-400 transition-spring hover:text-gray-600"
      >
        Volver al ticket
      </NuxtLink>
    </template>
  </div>
</template>
