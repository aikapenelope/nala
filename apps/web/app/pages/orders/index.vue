<script setup lang="ts">
/**
 * Orders management page.
 *
 * Lists storefront orders with tabs by status.
 * Polls every 30s for new orders.
 *
 * Connected to: GET /api/orders?status=...
 */

import { Clock, CheckCircle, Truck, XCircle, RefreshCw } from "lucide-vue-next";

const { $api } = useApi();

interface OrderRow {
  id: string;
  customerName: string;
  customerPhone: string;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  confirmedAt: string | null;
  deliveredAt: string | null;
}

type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled";

const tabs: { status: OrderStatus; label: string; icon: typeof Clock }[] = [
  { status: "pending", label: "Pendientes", icon: Clock },
  { status: "confirmed", label: "Confirmados", icon: CheckCircle },
  { status: "delivered", label: "Entregados", icon: Truck },
  { status: "cancelled", label: "Cancelados", icon: XCircle },
];

const activeTab = ref<OrderStatus>("pending");
const orders = ref<OrderRow[]>([]);
const pendingCount = ref(0);
const isLoading = ref(true);
const loadError = ref("");

/** Fetch orders for the active tab. */
async function fetchOrders() {
  loadError.value = "";
  try {
    const result = await $api<{
      orders: OrderRow[];
      pendingCount: number;
    }>(`/api/orders?status=${activeTab.value}&limit=50`);

    orders.value = result.orders;
    pendingCount.value = result.pendingCount;
  } catch {
    loadError.value = "Error cargando pedidos";
  } finally {
    isLoading.value = false;
  }
}

/** Switch tab and reload. */
function switchTab(status: OrderStatus) {
  activeTab.value = status;
  isLoading.value = true;
  fetchOrders();
}

/** Format date for display. */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin}min`;
  if (diffMin < 1440) return `Hace ${Math.floor(diffMin / 60)}h`;
  return date.toLocaleDateString("es-VE", { day: "numeric", month: "short" });
}

/** Payment method display label. */
const methodLabels: Record<string, string> = {
  pago_movil: "Pago Movil",
  binance: "Binance",
  zinli: "Zinli",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  zelle: "Zelle",
};

/** Polling interval. */
let pollInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  fetchOrders();
  // Poll every 30s for new orders
  pollInterval = setInterval(() => {
    fetchOrders();
  }, 30000);
});

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});

// Refetch when tab changes
watch(activeTab, () => {
  isLoading.value = true;
  fetchOrders();
});
</script>

<template>
  <div>
    <div class="mb-5 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight text-gradient">
          Pedidos
        </h1>
        <p class="mt-0.5 text-sm text-gray-500">
          Pedidos de tu tienda online
        </p>
      </div>
      <button
        class="flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-xs font-medium text-gray-600 shadow-sm hover:bg-white"
        @click="fetchOrders"
      >
        <RefreshCw :size="13" />
        Actualizar
      </button>
    </div>

    <!-- Tabs -->
    <div class="mb-4 flex gap-1 rounded-2xl bg-white/50 p-1">
      <button
        v-for="tab in tabs"
        :key="tab.status"
        class="relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-colors"
        :class="
          activeTab === tab.status
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        "
        @click="switchTab(tab.status)"
      >
        <component :is="tab.icon" :size="13" />
        {{ tab.label }}
        <!-- Pending badge -->
        <span
          v-if="tab.status === 'pending' && pendingCount > 0"
          class="ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
        >
          {{ pendingCount }}
        </span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-3 py-4">
      <div
        v-for="n in 3"
        :key="n"
        class="h-20 animate-pulse rounded-2xl bg-white/50"
      />
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
    </div>

    <!-- Empty state -->
    <div
      v-else-if="orders.length === 0"
      class="py-16 text-center"
    >
      <p class="text-sm font-medium text-gray-500">
        No hay pedidos {{ activeTab === "pending" ? "pendientes" : "" }}
      </p>
    </div>

    <!-- Orders list -->
    <div v-else class="space-y-2.5">
      <NuxtLink
        v-for="order in orders"
        :key="order.id"
        :to="`/orders/${order.id}`"
        class="card-lift flex items-center gap-3 rounded-2xl border border-white/80 bg-white/70 p-4 transition-spring"
      >
        <!-- Status indicator -->
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
          :class="{
            'bg-amber-100': order.status === 'pending',
            'bg-green-100': order.status === 'confirmed',
            'bg-blue-100': order.status === 'delivered',
            'bg-gray-100': order.status === 'cancelled',
          }"
        >
          <Clock
            v-if="order.status === 'pending'"
            :size="18"
            class="text-amber-600"
          />
          <CheckCircle
            v-else-if="order.status === 'confirmed'"
            :size="18"
            class="text-green-600"
          />
          <Truck
            v-else-if="order.status === 'delivered'"
            :size="18"
            class="text-blue-600"
          />
          <XCircle v-else :size="18" class="text-gray-400" />
        </div>

        <!-- Order info -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold text-gray-900">
              {{ order.customerName }}
            </p>
            <p class="text-sm font-bold text-gray-900">
              ${{ order.total.toFixed(2) }}
            </p>
          </div>
          <div class="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
            <span>{{ methodLabels[order.paymentMethod] ?? order.paymentMethod }}</span>
            <span class="text-gray-300">·</span>
            <span>{{ formatDate(order.createdAt) }}</span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
