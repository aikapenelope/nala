<script setup lang="ts">
/**
 * Sales history page.
 *
 * Connected to:
 * - GET /api/sales?date=&method=&page=&limit=
 * - POST /api/sales/:id/void
 */

import { Plus, Calendar, Share2, Download, RotateCcw, Minus } from "lucide-vue-next";
import { sendReceiptWhatsApp, downloadReceiptImage } from "~/composables/useReceiptImage";
import type { ReceiptData } from "~/composables/useReceiptImage";

const { isDesktop } = useDevice();
const { $api } = useApi();
const { toast } = useToast();
const { user } = useNovaAuth();

const dateFilter = ref("");
const methodFilter = ref<string | null>(null);
const isLoading = ref(true);
const loadError = ref("");

/** Sale type from API. */
interface Sale {
  id: string;
  createdAt: string;
  userId: string;
  customerId: string | null;
  customerName: string | null;
  totalUsd: string;
  totalBs: string | null;
  totalCostUsd: string | null;
  channel: string | null;
  status: "completed" | "voided";
}

const salesList = ref<Sale[]>([]);
const totalSales = ref(0);
const page = ref(1);
const limit = 50;

/** Fetch sales from API. */
async function fetchSales() {
  isLoading.value = true;
  loadError.value = "";

  try {
    const params = new URLSearchParams();
    if (dateFilter.value) params.set("date", dateFilter.value);
    if (methodFilter.value) params.set("method", methodFilter.value);
    params.set("page", String(page.value));
    params.set("limit", String(limit));

    const result = await $api<{
      sales: Sale[];
      total: number;
    }>(`/api/sales?${params.toString()}`);

    salesList.value = result.sales;
    totalSales.value = result.total;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando ventas";
    loadError.value = message;
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  await useOwnerLockRedirect();
  fetchSales();
});

watch([dateFilter, methodFilter], () => {
  page.value = 1;
  fetchSales();
});

/** Format date for display. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Calculate profit for a sale. Returns null if cost data is unavailable. */
function saleProfit(sale: Sale): number | null {
  if (!sale.totalCostUsd) return null;
  return Number(sale.totalUsd) - Number(sale.totalCostUsd);
}

/**
 * Share receipt as image via WhatsApp.
 * Fetches sale detail (items + payments) then uses the unified receipt composable.
 */
async function shareReceipt(saleId: string) {
  try {
    const detail = await $api<{
      sale: {
        totalUsd: string;
        totalBs: string | null;
        exchangeRate: string | null;
        discountPercent: string | null;
        discountAmount: string | null;
        surcharges: Array<{ name: string; amount: number }> | null;
        createdAt: string;
      };
      items: Array<{
        productName: string | null;
        quantity: number;
        unitPrice: string;
        lineTotal: string;
      }>;
      payments: Array<{ method: string }>;
    }>(`/api/sales/${saleId}`);

    const receiptData: ReceiptData = {
      businessName: user.value?.businessName ?? "Mi Negocio",
      items: detail.items.map((item) => ({
        name: item.productName ?? "Producto",
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
      subtotal: Number(detail.sale.totalUsd),
      surcharges: detail.sale.surcharges?.length
        ? detail.sale.surcharges
        : undefined,
      totalUsd: Number(detail.sale.totalUsd),
      totalBs: detail.sale.totalBs ? Number(detail.sale.totalBs) : undefined,
      exchangeRate: detail.sale.exchangeRate
        ? Number(detail.sale.exchangeRate)
        : undefined,
      paymentMethod: detail.payments[0]?.method ?? "efectivo",
      date: new Date(detail.sale.createdAt),
    };

    await sendReceiptWhatsApp(receiptData);
  } catch {
    toast("Error generando recibo", "error");
  }
}

/**
 * Download receipt as PNG image.
 * Fetches sale detail then generates and downloads the image.
 */
async function downloadReceipt(saleId: string) {
  try {
    const detail = await $api<{
      sale: {
        totalUsd: string;
        totalBs: string | null;
        exchangeRate: string | null;
        surcharges: Array<{ name: string; amount: number }> | null;
        createdAt: string;
      };
      items: Array<{
        productName: string | null;
        quantity: number;
        unitPrice: string;
        lineTotal: string;
      }>;
      payments: Array<{ method: string }>;
    }>(`/api/sales/${saleId}`);

    const receiptData: ReceiptData = {
      businessName: user.value?.businessName ?? "Mi Negocio",
      items: detail.items.map((item) => ({
        name: item.productName ?? "Producto",
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
      subtotal: Number(detail.sale.totalUsd),
      surcharges: detail.sale.surcharges?.length
        ? detail.sale.surcharges
        : undefined,
      totalUsd: Number(detail.sale.totalUsd),
      totalBs: detail.sale.totalBs ? Number(detail.sale.totalBs) : undefined,
      exchangeRate: detail.sale.exchangeRate
        ? Number(detail.sale.exchangeRate)
        : undefined,
      paymentMethod: detail.payments[0]?.method ?? "efectivo",
      date: new Date(detail.sale.createdAt),
    };

    const ok = downloadReceiptImage(receiptData);
    if (!ok) {
      toast("Error descargando recibo", "error");
    }
  } catch {
    toast("Error generando recibo", "error");
  }
}

/** Void sale flow: reason input -> API call (admin-only, no PIN needed). */
const showReasonModal = ref(false);
const voidingSaleId = ref<string | null>(null);
const voidReason = ref("");
const voidError = ref("");

/** Common void reasons for quick selection. */
const commonReasons = [
  "Error en el monto",
  "Cliente cancelo la compra",
  "Producto equivocado",
  "Duplicado",
];

/** Step 1: Show reason input. */
function requestVoid(saleId: string) {
  voidingSaleId.value = saleId;
  voidReason.value = "";
  voidError.value = "";
  showReasonModal.value = true;
}

/** Step 2: Reason entered, send void request directly. */
async function confirmReason() {
  if (!voidReason.value.trim() || !voidingSaleId.value) return;
  showReasonModal.value = false;

  try {
    await $api(`/api/sales/${voidingSaleId.value}/void`, {
      method: "POST",
      body: { reason: voidReason.value.trim() },
    });

    // Update local state
    const sale = salesList.value.find((s) => s.id === voidingSaleId.value);
    if (sale) sale.status = "voided";
    toast("Venta anulada");
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    voidError.value = fetchError.data?.error ?? "Error al anular la venta";
  }

  voidingSaleId.value = null;
  voidReason.value = "";
}

// ============================================================
// Partial return flow
// ============================================================

interface ReturnableItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  /** How many the user wants to return (editable). */
  returnQty: number;
}

const showReturnModal = ref(false);
const returnSaleId = ref<string | null>(null);
const returnItems = ref<ReturnableItem[]>([]);
const returnReason = ref("");
const returnLoading = ref(false);
const returnSubmitting = ref(false);
const returnError = ref("");

/** Open return modal: fetch sale items. */
async function openReturn(saleId: string) {
  returnSaleId.value = saleId;
  returnReason.value = "";
  returnError.value = "";
  returnLoading.value = true;
  showReturnModal.value = true;

  try {
    const detail = await $api<{
      items: Array<{
        id: string;
        productName: string | null;
        quantity: number;
        unitPrice: string;
        lineTotal: string;
      }>;
    }>(`/api/sales/${saleId}`);

    returnItems.value = detail.items.map((item) => ({
      id: item.id,
      productName: item.productName ?? "Producto",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      returnQty: 0,
    }));
  } catch {
    returnError.value = "Error cargando items de la venta";
  } finally {
    returnLoading.value = false;
  }
}

/** Items selected for return. */
const selectedReturnItems = computed(() =>
  returnItems.value.filter((item) => item.returnQty > 0),
);

/** Total refund amount (proportional to lineTotal, accounts for discounts). */
const returnTotal = computed(() => {
  return selectedReturnItems.value.reduce((sum, item) => {
    // Use lineTotal / quantity to get the effective per-unit price after discount
    const effectiveUnitPrice = Number(item.lineTotal) / item.quantity;
    return sum + effectiveUnitPrice * item.returnQty;
  }, 0);
});

const canSubmitReturn = computed(() => {
  return selectedReturnItems.value.length > 0 && returnReason.value.trim().length > 0;
});

function adjustReturnQty(item: ReturnableItem, delta: number) {
  const newQty = item.returnQty + delta;
  if (newQty < 0 || newQty > item.quantity) return;
  item.returnQty = newQty;
}

/** Submit partial return. */
async function submitReturn() {
  if (!canSubmitReturn.value || !returnSaleId.value) return;
  returnSubmitting.value = true;
  returnError.value = "";

  try {
    await $api(`/api/sales/${returnSaleId.value}/return`, {
      method: "POST",
      body: {
        reason: returnReason.value.trim(),
        items: selectedReturnItems.value.map((item) => ({
          saleItemId: item.id,
          quantity: item.returnQty,
        })),
      },
    });

    showReturnModal.value = false;
    toast(`Devolucion procesada: $${returnTotal.value.toFixed(2)}`);
    fetchSales(); // Refresh list
  } catch (err) {
    const fetchError = err as { data?: { error?: string; details?: string[] } };
    returnError.value = fetchError.data?.details?.join(", ") ?? fetchError.data?.error ?? "Error al procesar devolucion";
  } finally {
    returnSubmitting.value = false;
  }
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-extrabold tracking-tight text-gradient">
        Historial de ventas
      </h1>
      <NuxtLink
        to="/sales"
        class="dark-pill flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-bold transition-spring"
      >
        <Plus :size="14" />
        Nueva venta
      </NuxtLink>
    </div>

    <!-- Filters -->
    <div class="mb-4 flex gap-3">
      <div class="glass relative flex items-center rounded-2xl px-4 py-2.5">
        <Calendar :size="14" class="mr-2 flex-shrink-0 text-gray-400" />
        <input
          v-model="dateFilter"
          type="date"
          class="bg-transparent text-sm font-medium text-gray-700 outline-none"
        />
      </div>
      <select
        v-model="methodFilter"
        class="glass rounded-2xl border-0 px-4 py-2.5 text-sm font-bold text-gray-700 outline-none"
      >
        <option :value="null">Todos los metodos</option>
        <option value="efectivo">Efectivo</option>
        <option value="pago_movil">Pago Movil</option>
        <option value="binance">Binance</option>
        <option value="zinli">Zinli</option>
        <option value="transferencia">Transferencia</option>
        <option value="zelle">Zelle</option>
        <option value="fiado">Fiado</option>
      </select>
    </div>

    <!-- Void error -->
    <div v-if="voidError" class="mb-4 card-premium p-3">
      <p class="text-sm font-semibold text-red-500">{{ voidError }}</p>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      <div
        class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary"
      />
      Cargando ventas...
    </div>

    <!-- Error -->
    <div v-else-if="loadError" class="card-premium p-6 text-center">
      <p class="text-sm font-semibold text-red-500">{{ loadError }}</p>
      <button
        class="mt-3 text-xs font-bold text-nova-primary underline"
        @click="fetchSales"
      >
        Reintentar
      </button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="salesList.length === 0"
      class="card-premium py-12 text-center"
    >
      <p class="text-sm font-medium text-gray-400">
        No hay ventas{{ dateFilter ? " en esta fecha" : "" }}
      </p>
    </div>

    <template v-else>
      <!-- Desktop: Table -->
      <div v-if="isDesktop" class="card-premium overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-white/50">
            <tr>
              <th
                class="px-4 py-3.5 text-[11px] font-bold tracking-wider text-gray-400 uppercase"
              >
                Fecha
              </th>
              <th
                class="px-4 py-3.5 text-[11px] font-bold tracking-wider text-gray-400 uppercase"
              >
                Cliente
              </th>
              <th
                class="px-4 py-3.5 text-right text-[11px] font-bold tracking-wider text-gray-400 uppercase"
              >
                Total
              </th>
              <th
                class="px-4 py-3.5 text-right text-[11px] font-bold tracking-wider text-gray-400 uppercase"
              >
                Utilidad
              </th>
              <th
                class="px-4 py-3.5 text-[11px] font-bold tracking-wider text-gray-400 uppercase"
              >
                Canal
              </th>
              <th
                class="px-4 py-3.5 text-[11px] font-bold tracking-wider text-gray-400 uppercase"
              >
                Estado
              </th>
              <th class="px-4 py-3.5" />
            </tr>
          </thead>
          <tbody class="divide-y divide-white/30">
            <tr
              v-for="sale in salesList"
              :key="sale.id"
              class="transition-spring hover:bg-white/60"
              :class="{ 'opacity-40': sale.status === 'voided' }"
            >
              <td class="px-4 py-3.5 font-medium text-gray-700">
                {{ formatDate(sale.createdAt) }}
              </td>
              <td class="px-4 py-3.5 text-sm text-gray-600">
                {{ sale.customerName ?? "—" }}
              </td>
              <td class="px-4 py-3.5 text-right">
                <span class="font-bold text-gray-800"
                  >${{ Number(sale.totalUsd).toFixed(2) }}</span
                >
                <span v-if="sale.totalBs" class="ml-1 text-xs text-gray-400">
                  Bs.{{ Number(sale.totalBs).toFixed(2) }}
                </span>
              </td>
              <td class="px-4 py-3.5 text-right text-sm">
                <template v-if="saleProfit(sale) !== null">
                  <span
                    class="rounded-lg px-1.5 py-0.5 text-xs font-bold"
                    :class="
                      saleProfit(sale)! >= 0
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-600'
                    "
                  >
                    {{ saleProfit(sale)! >= 0 ? "+" : "" }}${{
                      saleProfit(sale)!.toFixed(2)
                    }}
                  </span>
                </template>
                <span v-else class="text-gray-300">--</span>
              </td>
              <td class="px-4 py-3.5">
                <span
                  class="rounded-lg bg-gray-100/80 px-2 py-0.5 text-[11px] font-bold text-gray-500"
                >
                  {{ sale.channel ?? "pos" }}
                </span>
              </td>
              <td class="px-4 py-3.5">
                <span
                  class="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                  :class="
                    sale.status === 'voided'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-green-50 text-green-700'
                  "
                >
                  {{ sale.status === "voided" ? "Anulada" : "Completada" }}
                </span>
              </td>
              <td class="px-4 py-3.5">
                <div class="flex gap-2">
                  <button
                    v-if="sale.status === 'completed'"
                    class="rounded-xl bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700 transition-spring hover:bg-green-100"
                    @click="shareReceipt(sale.id)"
                  >
                    <Share2 :size="12" class="inline" /> WhatsApp
                  </button>
                  <button
                    v-if="sale.status === 'completed'"
                    class="rounded-xl bg-nova-primary/10 px-2.5 py-1 text-[11px] font-bold text-nova-primary transition-spring hover:bg-nova-primary/20"
                    @click="downloadReceipt(sale.id)"
                  >
                    <Download :size="12" class="inline" /> PNG
                  </button>
                  <button
                    v-if="sale.status === 'completed'"
                    class="rounded-xl bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 transition-spring hover:bg-amber-100"
                    @click="openReturn(sale.id)"
                  >
                    <RotateCcw :size="12" class="inline" /> Devolver
                  </button>
                  <button
                    v-if="sale.status === 'completed'"
                    class="rounded-xl bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600 transition-spring hover:bg-red-100"
                    @click="requestVoid(sale.id)"
                  >
                    Anular
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile: Card list -->
      <div v-else class="space-y-2.5">
        <div
          v-for="sale in salesList"
          :key="sale.id"
          class="card-premium p-4"
          :class="{ 'opacity-40': sale.status === 'voided' }"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="font-bold text-gray-800">
                ${{ Number(sale.totalUsd).toFixed(2) }}
                <span
                  v-if="saleProfit(sale) !== null"
                  class="ml-1 rounded-lg px-1.5 py-0.5 text-[10px] font-bold"
                  :class="
                    saleProfit(sale)! >= 0
                      ? 'bg-green-50 text-green-600'
                      : 'bg-red-50 text-red-600'
                  "
                >
                  {{ saleProfit(sale)! >= 0 ? "+" : "" }}${{
                    saleProfit(sale)!.toFixed(2)
                  }}
                </span>
              </p>
              <p class="mt-0.5 text-xs font-medium text-gray-500">
                {{ formatDate(sale.createdAt) }}
                <span v-if="sale.customerName" class="ml-1 text-gray-600 font-semibold">
                  · {{ sale.customerName }}
                </span>
                <span v-if="sale.channel" class="ml-1 text-gray-400">
                  · {{ sale.channel }}
                </span>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                :class="
                  sale.status === 'voided'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-green-50 text-green-700'
                "
              >
                {{ sale.status === "voided" ? "Anulada" : "Completada" }}
              </span>
              <button
                v-if="sale.status === 'completed'"
                class="rounded-lg bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 transition-spring hover:bg-green-100"
                title="Enviar por WhatsApp"
                @click="shareReceipt(sale.id)"
              >
                <Share2 :size="10" class="inline" />
              </button>
              <button
                v-if="sale.status === 'completed'"
                class="rounded-lg bg-nova-primary/10 px-2 py-0.5 text-[10px] font-bold text-nova-primary transition-spring hover:bg-nova-primary/20"
                title="Descargar recibo"
                @click="downloadReceipt(sale.id)"
              >
                <Download :size="10" class="inline" />
              </button>
              <button
                v-if="sale.status === 'completed'"
                class="rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 transition-spring hover:bg-amber-100"
                @click="openReturn(sale.id)"
              >
                <RotateCcw :size="10" class="inline" />
              </button>
              <button
                v-if="sale.status === 'completed'"
                class="rounded-lg bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500 transition-spring hover:bg-red-100"
                @click="requestVoid(sale.id)"
              >
                Anular
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <p
        v-if="totalSales > limit"
        class="mt-4 text-center text-xs font-medium text-gray-400"
      >
        Mostrando {{ salesList.length }} de {{ totalSales }} ventas
      </p>
    </template>

    <!-- Step 1: Void reason modal -->
    <Teleport to="body">
      <div
        v-if="showReasonModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showReasonModal = false"
      >
        <div
          class="glass-strong w-full max-w-sm rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]"
        >
          <h3 class="mb-1 text-xl font-extrabold tracking-tight text-gradient">
            Motivo de anulacion
          </h3>
          <p class="mb-5 text-[13px] font-medium text-gray-500">
            Indica por que se anula esta venta
          </p>

          <!-- Quick reason buttons -->
          <div class="mb-3 flex flex-wrap gap-2">
            <button
              v-for="reason in commonReasons"
              :key="reason"
              class="rounded-full border px-3 py-1.5 text-xs font-bold transition-spring"
              :class="
                voidReason === reason
                  ? 'border-nova-accent bg-purple-50 text-nova-accent'
                  : 'border-white/80 bg-white/40 text-gray-600 hover:bg-white/70'
              "
              @click="voidReason = reason"
            >
              {{ reason }}
            </button>
          </div>

          <!-- Custom reason input -->
          <textarea
            v-model="voidReason"
            rows="2"
            placeholder="O escribe el motivo..."
            class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
          />

          <div class="mt-5 flex gap-3">
            <button
              class="glass flex-1 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
              @click="showReasonModal = false"
            >
              Cancelar
            </button>
            <button
              class="flex-1 rounded-2xl bg-red-600 py-3 text-sm font-bold text-white transition-spring disabled:opacity-50"
              :disabled="!voidReason.trim()"
              @click="confirmReason"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Partial return modal -->
    <Teleport to="body">
      <div
        v-if="showReturnModal"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showReturnModal = false"
      >
        <div class="glass-strong w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] max-h-[85vh] overflow-y-auto">
          <h3 class="mb-1 text-xl font-extrabold tracking-tight text-gradient">
            Devolucion parcial
          </h3>
          <p class="mb-4 text-[13px] font-medium text-gray-500">
            Selecciona los items y cantidades a devolver
          </p>

          <!-- Loading -->
          <div v-if="returnLoading" class="py-8 text-center text-gray-400">
            <div class="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary" />
            Cargando items...
          </div>

          <!-- Items list -->
          <div v-else-if="returnItems.length > 0" class="space-y-2">
            <div
              v-for="item in returnItems"
              :key="item.id"
              class="flex items-center justify-between rounded-xl border border-gray-100 bg-white/60 p-3"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-gray-800">{{ item.productName }}</p>
                <p class="text-xs text-gray-400">
                  {{ item.quantity }} x ${{ Number(item.unitPrice).toFixed(2) }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button
                  class="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-spring hover:bg-gray-200"
                  :disabled="item.returnQty <= 0"
                  @click="adjustReturnQty(item, -1)"
                >
                  <Minus :size="12" />
                </button>
                <span
                  class="min-w-[24px] text-center text-sm font-bold"
                  :class="item.returnQty > 0 ? 'text-amber-700' : 'text-gray-300'"
                >
                  {{ item.returnQty }}
                </span>
                <button
                  class="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-spring hover:bg-gray-200"
                  :disabled="item.returnQty >= item.quantity"
                  @click="adjustReturnQty(item, 1)"
                >
                  <Plus :size="12" />
                </button>
              </div>
            </div>

            <!-- Refund total -->
            <div v-if="returnTotal > 0" class="mt-3 text-center">
              <p class="text-xs font-medium text-gray-500">Reembolso</p>
              <p class="text-xl font-extrabold text-amber-700">${{ returnTotal.toFixed(2) }}</p>
            </div>

            <!-- Reason -->
            <div class="mt-3">
              <input
                v-model="returnReason"
                type="text"
                placeholder="Motivo de la devolucion"
                class="w-full rounded-xl border border-gray-200 bg-white/60 px-4 py-2.5 text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5"
              >
            </div>

            <!-- Error -->
            <p v-if="returnError" class="mt-2 text-xs text-red-500">{{ returnError }}</p>

            <!-- Actions -->
            <div class="mt-4 flex gap-3">
              <button
                class="glass flex-1 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
                @click="showReturnModal = false"
              >
                Cancelar
              </button>
              <button
                class="flex-1 rounded-2xl bg-amber-600 py-3 text-sm font-bold text-white transition-spring disabled:opacity-50"
                :disabled="!canSubmitReturn || returnSubmitting"
                @click="submitReturn"
              >
                {{ returnSubmitting ? "Procesando..." : "Confirmar devolucion" }}
              </button>
            </div>
          </div>

          <!-- Error loading -->
          <div v-else-if="returnError" class="py-6 text-center">
            <p class="text-sm text-red-500">{{ returnError }}</p>
            <button
              class="mt-3 text-xs font-bold text-gray-500"
              @click="showReturnModal = false"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
