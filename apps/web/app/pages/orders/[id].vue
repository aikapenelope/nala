<script setup lang="ts">
/**
 * Order detail page with action buttons.
 *
 * Shows full order info (customer, items, payment, timeline)
 * and allows the vendor to confirm, deliver, or cancel.
 *
 * Connected to:
 * - GET   /api/orders/:id
 * - PATCH /api/orders/:id/confirm
 * - PATCH /api/orders/:id/deliver
 * - PATCH /api/orders/:id/cancel
 */

import {
  ArrowLeft,
  CheckCircle,
  Truck,
  XCircle,
  Clock,
  Phone,
  User,
  MessageSquare,
  Share2,
  Download,
} from "lucide-vue-next";
import { sendReceiptWhatsApp, downloadReceiptImage } from "~/composables/useReceiptImage";
import type { ReceiptData } from "~/composables/useReceiptImage";

const route = useRoute();
const { $api } = useApi();
const { user } = useNovaAuth();
const orderId = route.params.id as string;

interface OrderDetail {
  id: string;
  businessId: string;
  customerName: string;
  customerPhone: string;
  customerNotes: string | null;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    lineTotal: number;
  }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  paymentProofUrl: string | null;
  paymentReference: string | null;
  status: string;
  exchangeRate: number | null;
  totalBs: number | null;
  confirmedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
}

const order = ref<OrderDetail | null>(null);
const isLoading = ref(true);
const loadError = ref("");

// Proof image state
const proofImageUrl = ref<string | null>(null);
const showProofModal = ref(false);

// Action state
const isActioning = ref(false);
const actionError = ref("");
const showCancelModal = ref(false);
const cancelReason = ref("");

/** Fetch order detail. */
async function fetchOrder() {
  isLoading.value = true;
  loadError.value = "";
  try {
    const result = await $api<{ order: OrderDetail }>(`/api/orders/${orderId}`);
    order.value = result.order;

    // Fetch proof URL if available
    if (result.order.paymentProofUrl) {
      fetchProofUrl();
    }
  } catch {
    loadError.value = "Error cargando pedido";
  } finally {
    isLoading.value = false;
  }
}

/** Fetch presigned URL for the payment proof image. */
async function fetchProofUrl() {
  try {
    const result = await $api<{ url: string }>(
      `/api/orders/${orderId}/proof-url`,
    );
    proofImageUrl.value = result.url;
  } catch {
    // Silently fail - proof display is non-critical
  }
}

/** Confirm the order. */
async function confirmOrder() {
  if (!order.value || isActioning.value) return;
  isActioning.value = true;
  actionError.value = "";
  try {
    await $api(`/api/orders/${orderId}/confirm`, { method: "PATCH" });
    order.value.status = "confirmed";
    order.value.confirmedAt = new Date().toISOString();
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    actionError.value = fetchError.data?.error ?? "Error al confirmar pedido";
  } finally {
    isActioning.value = false;
  }
}

/** Mark as delivered. */
async function deliverOrder() {
  if (!order.value || isActioning.value) return;
  isActioning.value = true;
  actionError.value = "";
  try {
    await $api(`/api/orders/${orderId}/deliver`, { method: "PATCH" });
    order.value.status = "delivered";
    order.value.deliveredAt = new Date().toISOString();
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    actionError.value = fetchError.data?.error ?? "Error al marcar entregado";
  } finally {
    isActioning.value = false;
  }
}

/** Cancel the order. */
async function cancelOrder() {
  if (!order.value || isActioning.value || !cancelReason.value.trim()) return;
  isActioning.value = true;
  actionError.value = "";
  try {
    await $api(`/api/orders/${orderId}/cancel`, {
      method: "PATCH",
      body: { reason: cancelReason.value.trim() },
    });
    order.value.status = "cancelled";
    order.value.cancelledAt = new Date().toISOString();
    order.value.cancelReason = cancelReason.value.trim();
    showCancelModal.value = false;
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    actionError.value = fetchError.data?.error ?? "Error al cancelar pedido";
  } finally {
    isActioning.value = false;
  }
}

/** Format date. */
function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("es-VE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Payment method labels. */
const methodLabels: Record<string, string> = {
  pago_movil: "Pago Movil",
  binance: "Binance",
  zinli: "Zinli",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  zelle: "Zelle",
};

/** Status display config. */
const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "text-amber-600 bg-amber-50" },
  confirmed: { label: "Confirmado", color: "text-green-600 bg-green-50" },
  delivered: { label: "Entregado", color: "text-blue-600 bg-blue-50" },
  cancelled: { label: "Cancelado", color: "text-gray-500 bg-gray-100" },
};

/** Build receipt data from order. */
function buildOrderReceiptData(): ReceiptData | null {
  if (!order.value) return null;
  return {
    businessName: user.value?.businessName ?? "Mi Negocio",
    items: order.value.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.price,
      lineTotal: i.lineTotal,
    })),
    subtotal: order.value.subtotal,
    totalUsd: order.value.total,
    totalBs: order.value.totalBs ?? undefined,
    exchangeRate: order.value.exchangeRate ?? undefined,
    paymentMethod:
      methodLabels[order.value.paymentMethod] ?? order.value.paymentMethod,
    date: new Date(order.value.createdAt),
  };
}

/** Send order receipt via WhatsApp to the customer. */
function sendOrderReceiptWA() {
  const data = buildOrderReceiptData();
  if (!data) return;
  sendReceiptWhatsApp(data, order.value?.customerPhone);
}

/** Download order receipt as PNG. */
function downloadOrderReceipt() {
  const data = buildOrderReceiptData();
  if (!data) return;
  downloadReceiptImage(data);
}

onMounted(fetchOrder);
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <!-- Header -->
    <NuxtLink
      to="/orders"
      class="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
    >
      <ArrowLeft :size="16" />
      Pedidos
    </NuxtLink>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando pedido...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
    </div>

    <!-- Order detail -->
    <template v-else-if="order">
      <!-- Status badge + order ID -->
      <div class="mb-5 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            Pedido #{{ order.id.slice(0, 8).toUpperCase() }}
          </h1>
          <p class="mt-0.5 text-xs text-gray-500">
            {{ formatDateTime(order.createdAt) }}
          </p>
        </div>
        <span
          class="rounded-full px-3 py-1 text-xs font-bold"
          :class="statusConfig[order.status]?.color ?? 'bg-gray-100 text-gray-500'"
        >
          {{ statusConfig[order.status]?.label ?? order.status }}
        </span>
      </div>

      <!-- Customer info -->
      <div class="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Cliente
        </p>
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <User :size="14" class="text-gray-400" />
            <span class="text-sm font-medium text-gray-900">{{ order.customerName }}</span>
          </div>
          <div class="flex items-center gap-2">
            <Phone :size="14" class="text-gray-400" />
            <a
              :href="`tel:${order.customerPhone}`"
              class="text-sm text-blue-600 hover:underline"
            >
              {{ order.customerPhone }}
            </a>
          </div>
          <div v-if="order.customerNotes" class="flex items-start gap-2">
            <MessageSquare :size="14" class="mt-0.5 text-gray-400" />
            <span class="text-sm text-gray-600">{{ order.customerNotes }}</span>
          </div>
        </div>
      </div>

      <!-- Items -->
      <div class="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Productos
        </p>
        <div class="space-y-2">
          <div
            v-for="item in order.items"
            :key="item.productId"
            class="flex justify-between text-sm"
          >
            <span class="text-gray-700">
              {{ item.name }}
              <span class="text-gray-400">x{{ item.quantity }}</span>
            </span>
            <span class="font-semibold text-gray-900">
              ${{ item.lineTotal.toFixed(2) }}
            </span>
          </div>
        </div>
        <div class="mt-3 space-y-1 border-t border-gray-100 pt-2">
          <div class="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>${{ order.subtotal.toFixed(2) }}</span>
          </div>
          <div
            v-if="order.deliveryFee > 0"
            class="flex justify-between text-sm text-gray-600"
          >
            <span>Delivery</span>
            <span>${{ order.deliveryFee.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-base font-bold text-gray-900">
            <span>Total</span>
            <span>${{ order.total.toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <!-- Payment info -->
      <div class="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Pago
        </p>
        <p class="text-sm font-medium text-gray-900">
          {{ methodLabels[order.paymentMethod] ?? order.paymentMethod }}
        </p>
        <p v-if="order.paymentReference" class="mt-1 text-xs text-gray-500">
          Referencia: {{ order.paymentReference }}
        </p>
      </div>

      <!-- Payment proof image -->
      <div
        v-if="order.paymentProofUrl"
        class="mb-4 rounded-xl bg-white p-4 shadow-sm"
      >
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Comprobante de pago
        </p>
        <div v-if="proofImageUrl" class="relative">
          <img
            :src="proofImageUrl"
            alt="Comprobante de pago"
            class="w-full cursor-pointer rounded-xl object-cover"
            style="max-height: 240px"
            @click="showProofModal = true"
          >
          <span class="mt-1 block text-[10px] text-gray-400">
            Toca para ampliar
          </span>
        </div>
        <div v-else class="flex items-center gap-2 py-2 text-xs text-gray-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          Cargando imagen...
        </div>
      </div>

      <!-- No proof indicator -->
      <div
        v-else-if="order.status === 'pending'"
        class="mb-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-3"
      >
        <p class="text-xs font-medium text-amber-700">
          El cliente no ha subido comprobante de pago.
        </p>
      </div>

      <!-- Timeline -->
      <div class="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Timeline
        </p>
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-sm">
            <Clock :size="14" class="text-gray-400" />
            <span class="text-gray-600">Creado:</span>
            <span class="font-medium">{{ formatDateTime(order.createdAt) }}</span>
          </div>
          <div v-if="order.confirmedAt" class="flex items-center gap-2 text-sm">
            <CheckCircle :size="14" class="text-green-500" />
            <span class="text-gray-600">Confirmado:</span>
            <span class="font-medium">{{ formatDateTime(order.confirmedAt) }}</span>
          </div>
          <div v-if="order.deliveredAt" class="flex items-center gap-2 text-sm">
            <Truck :size="14" class="text-blue-500" />
            <span class="text-gray-600">Entregado:</span>
            <span class="font-medium">{{ formatDateTime(order.deliveredAt) }}</span>
          </div>
          <div v-if="order.cancelledAt" class="flex items-center gap-2 text-sm">
            <XCircle :size="14" class="text-red-500" />
            <span class="text-gray-600">Cancelado:</span>
            <span class="font-medium">{{ formatDateTime(order.cancelledAt) }}</span>
          </div>
          <p
            v-if="order.cancelReason"
            class="ml-6 text-xs text-gray-500"
          >
            Motivo: {{ order.cancelReason }}
          </p>
        </div>
      </div>

      <!-- Action error -->
      <p v-if="actionError" class="mb-3 text-center text-sm font-medium text-red-600">
        {{ actionError }}
      </p>

      <!-- Action buttons -->
      <div class="space-y-2">
        <!-- Confirm -->
        <button
          v-if="order.status === 'pending'"
          class="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          :disabled="isActioning"
          @click="confirmOrder"
        >
          <CheckCircle :size="16" />
          {{ isActioning ? "Confirmando..." : "Confirmar pedido" }}
        </button>

        <!-- Deliver -->
        <button
          v-if="order.status === 'confirmed'"
          class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          :disabled="isActioning"
          @click="deliverOrder"
        >
          <Truck :size="16" />
          {{ isActioning ? "Procesando..." : "Marcar como entregado" }}
        </button>

        <!-- Cancel -->
        <button
          v-if="order.status === 'pending' || order.status === 'confirmed'"
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
          :disabled="isActioning"
          @click="showCancelModal = true"
        >
          <XCircle :size="16" />
          Cancelar pedido
        </button>

        <!-- WhatsApp contact -->
        <a
          :href="`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}`"
          target="_blank"
          rel="noopener noreferrer"
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <Phone :size="16" />
          Contactar por WhatsApp
        </a>

        <!-- Receipt actions -->
        <div class="flex gap-2">
          <button
            class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-50 py-3 text-sm font-bold text-green-700 transition-colors hover:bg-green-100"
            @click="sendOrderReceiptWA"
          >
            <Share2 :size="16" />
            Enviar recibo
          </button>
          <button
            class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-nova-primary/10 py-3 text-sm font-bold text-nova-primary transition-colors hover:bg-nova-primary/20"
            @click="downloadOrderReceipt"
          >
            <Download :size="16" />
            Descargar recibo
          </button>
        </div>
      </div>
    </template>

    <!-- Cancel modal -->
    <Teleport to="body">
      <div
        v-if="showCancelModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showCancelModal = false"
      >
        <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="mb-3 text-lg font-bold text-gray-900">Cancelar pedido</h3>
          <p class="mb-4 text-sm text-gray-500">
            Indica el motivo de la cancelacion.
          </p>
          <textarea
            v-model="cancelReason"
            rows="3"
            placeholder="Motivo de cancelacion..."
            class="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-400 focus:outline-none"
          />
          <div class="mt-4 flex gap-3">
            <button
              class="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700"
              @click="showCancelModal = false"
            >
              Volver
            </button>
            <button
              class="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              :disabled="!cancelReason.trim() || isActioning"
              @click="cancelOrder"
            >
              {{ isActioning ? "Cancelando..." : "Confirmar cancelacion" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Proof image fullscreen modal -->
    <Teleport to="body">
      <div
        v-if="showProofModal && proofImageUrl"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        @click.self="showProofModal = false"
      >
        <div class="relative max-h-[90vh] max-w-lg">
          <img
            :src="proofImageUrl"
            alt="Comprobante de pago"
            class="max-h-[85vh] rounded-xl object-contain"
          >
          <button
            class="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-900 shadow-lg"
            @click="showProofModal = false"
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
      </div>
    </Teleport>
  </div>
</template>
