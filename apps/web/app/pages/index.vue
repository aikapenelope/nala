<script setup lang="ts">
/**
 * Dashboard - data-rich, single screen with weekly chart.
 *
 * Shows: sales hero, 3 summary cards, weekly bar chart, payment mix,
 * 4 insight tiles (seller, product, alerts, margin), CTA.
 *
 * Connected to:
 * - GET /api/reports/daily (sales, profit, topSeller, topProducts, salesByMethod)
 * - GET /api/reports/weekly (dailyBreakdown for chart)
 * - GET /api/reports/financial (grossMargin)
 * - GET /api/accounts/receivable (totalPending)
 * - GET /api/reports/inventory (lowStock + criticalStock)
 * - GET /api/reports/cash-flow (projection7d.net)
 * - GET /api/reports/alerts (count)
 * - GET /api/exchange-rate (rateBcv, rateEur)
 * - GET /api/cash-opening/latest (caja abierta hoy?)
 */

import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Package,
  ShoppingBag,
  Star,
  Wallet,
  RefreshCw,
  BarChart3,
} from "lucide-vue-next";

const { user } = useNovaAuth();
const { $api } = useApi();
const { pendingCount: pendingOrdersCount } = useOrdersBadge();
const {
  steps: onboardingSteps,
  allComplete: onboardingComplete,
  completedCount: onboardingCompletedCount,
  refresh: refreshOnboarding,
} = useOnboardingChecklist();

const isLoading = ref(true);
const loadError = ref("");

/** Daily data. */
const todaySales = ref(0);
const todayCount = ref(0);
const todayAvgTicket = ref(0);
const todayProfit = ref(0);
const trendPercent = ref(0);
const trendPositive = ref(true);
const topSeller = ref<{ name: string; total: number } | null>(null);
const topProduct = ref<{ name: string; quantity: number } | null>(null);
const salesByMethod = ref<Record<string, number>>({});

/** Weekly chart data. */
const weeklyDays = ref<Array<{ day: string; amount: number }>>([]);

/** Financial margin. */
const grossMargin = ref(0);

/** Summary cards. */
const receivableTotal = ref(0);
const lowStockCount = ref(0);
const cashFlow7d = ref(0);

/** Smart alerts for dashboard display. */
interface SmartAlert {
  id: string;
  icon: string;
  title: string;
  suggestion: string;
  actionLabel: string;
  actionTo: string;
  severity: "critical" | "warning" | "info";
}
const dashboardAlerts = ref<SmartAlert[]>([]);

/** Exchange rate. */
const exchangeRate = ref<number | null>(null);
const euroRate = ref<number | null>(null);
const showRateEditor = ref(false);
const rateInputUsd = ref("");
const rateInputEur = ref("");
const rateSaving = ref(false);
const rateSaveError = ref("");

/** Receivables due today or overdue. */
interface DueReceivable {
  id: string;
  customerName: string;
  customerPhone: string | null;
  balanceUsd: string;
  dueDate: string | null;
}
const dueToday = ref<DueReceivable[]>([]);

/** Sync status. */
const syncStatus = ref<"online" | "offline" | "syncing">("online");

/** Pending orders for quick action. */
interface PendingOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  total: number;
  paymentMethod: string;
  createdAt: string;
}
const pendingOrders = ref<PendingOrder[]>([]);
const confirmingOrderId = ref<string | null>(null);

/** Recent activity feed. */
interface FeedItem {
  id: string;
  icon: string;
  text: string;
  time: string;
  to?: string;
}
const activityFeed = ref<FeedItem[]>([]);

const methodLabel: Record<string, string> = {
  efectivo: "Efectivo",
  pago_movil: "Pago Movil",
  binance: "Binance",
  zinli: "Zinli",
  transferencia: "Transferencia",
  zelle: "Zelle",
  fiado: "Fiado",
};

/** Quick confirm an order from the dashboard. */
async function quickConfirmOrder(orderId: string) {
  confirmingOrderId.value = orderId;
  try {
    await $api(`/api/orders/${orderId}/confirm`, { method: "PATCH" });
    pendingOrders.value = pendingOrders.value.filter((o) => o.id !== orderId);
  } catch {
    // Non-critical: user can go to /orders to retry
  } finally {
    confirmingOrderId.value = null;
  }
}

/** Format relative time for feed. */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min}min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return new Date(dateStr).toLocaleDateString("es-VE", { day: "numeric", month: "short" });
}

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos dias";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
});

/** Load all dashboard data in parallel. */
let loadInProgress = false;
async function loadDashboard() {
  if (loadInProgress) return;
  loadInProgress = true;
  isLoading.value = true;
  loadError.value = "";

  try {
    const [
      dailyResult,
      weeklyResult,
      financialResult,
      receivableResult,
      inventoryResult,
      alertsResult,
      rateResult,
      cashFlowResult,
      ordersResult,
      recentSalesResult,
    ] = await Promise.allSettled([
      $api<{
        data: {
          totalSales: number;
          totalCount: number;
          avgTicket: number;
          totalProfit: number;
          topSeller: { name: string; total: number } | null;
          vsSameDayLastWeek: number;
          topProducts: Array<{ name: string; quantity: number }>;
          salesByMethod: Record<string, number>;
        };
      }>("/api/reports/daily"),

      $api<{
        data: { dailyBreakdown: Array<{ day: string; amount: number }> };
      }>("/api/reports/weekly?period=week"),

      $api<{
        data: { grossMargin: number };
      }>("/api/reports/financial?period=month"),

      $api<{ accounts: DueReceivable[]; totalPending: number }>("/api/accounts/receivable"),

      $api<{ data: { lowStock: number; criticalStock: number } }>(
        "/api/reports/inventory",
      ),

      $api<{ alerts: SmartAlert[] }>("/api/reports/alerts"),

      $api<{ rateBcv: number; rateEur: number | null }>("/api/exchange-rate"),

      $api<{ data: { projection7d: { net: number } } }>(
        "/api/reports/cash-flow",
      ),

      $api<{ orders: PendingOrder[]; pendingCount: number }>("/api/orders?status=pending&limit=5"),

      $api<{ sales: Array<{ id: string; totalUsd: string; channel: string; createdAt: string }> }>(
        "/api/sales?limit=5",
      ),
    ]);

    if (dailyResult.status === "fulfilled") {
      const d = dailyResult.value.data;
      todaySales.value = d.totalSales;
      todayCount.value = d.totalCount;
      todayAvgTicket.value = d.avgTicket;
      todayProfit.value = d.totalProfit;
      trendPercent.value = Math.abs(d.vsSameDayLastWeek);
      trendPositive.value = d.vsSameDayLastWeek >= 0;
      topSeller.value = d.topSeller;
      topProduct.value = d.topProducts?.[0] ?? null;
      salesByMethod.value = d.salesByMethod ?? {};
    }

    if (weeklyResult.status === "fulfilled") {
      weeklyDays.value = weeklyResult.value.data.dailyBreakdown;
    }

    if (financialResult.status === "fulfilled") {
      grossMargin.value = financialResult.value.data.grossMargin;
    }

    if (receivableResult.status === "fulfilled") {
      receivableTotal.value = receivableResult.value.totalPending;

      // Filter receivables due today or overdue for the dashboard section
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      dueToday.value = (receivableResult.value.accounts ?? [])
        .filter((a) => a.dueDate && new Date(a.dueDate) <= today)
        .slice(0, 5);
    }

    if (inventoryResult.status === "fulfilled") {
      const inv = inventoryResult.value.data;
      lowStockCount.value = (inv.lowStock ?? 0) + (inv.criticalStock ?? 0);
    }

    if (alertsResult.status === "fulfilled") {
      dashboardAlerts.value = alertsResult.value.alerts.slice(0, 5);
    }

    if (rateResult.status === "fulfilled") {
      exchangeRate.value = rateResult.value.rateBcv;
      euroRate.value = rateResult.value.rateEur;
    }

    if (cashFlowResult.status === "fulfilled") {
      cashFlow7d.value = cashFlowResult.value.data.projection7d.net;
    }

    // Pending orders for quick action
    if (ordersResult.status === "fulfilled") {
      pendingOrders.value = ordersResult.value.orders.slice(0, 5);
    }

    // Build activity feed from recent sales
    if (recentSalesResult.status === "fulfilled") {
      const feed: FeedItem[] = [];
      for (const sale of recentSalesResult.value.sales.slice(0, 5)) {
        const channelLabel = sale.channel === "pos" ? "POS" : sale.channel === "online" ? "Online" : sale.channel;
        feed.push({
          id: `sale-${sale.id}`,
          icon: "💰",
          text: `Venta ${channelLabel} $${Number(sale.totalUsd).toFixed(2)}`,
          time: timeAgo(sale.createdAt),
          to: `/sales/history`,
        });
      }
      activityFeed.value = feed;
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando dashboard";
    loadError.value = message;
  } finally {
    isLoading.value = false;
    loadInProgress = false;
  }
}

/** Pull-to-refresh for PWA mobile. */
const pullDistance = ref(0);
const isPulling = ref(false);
const isRefreshing = ref(false);
let touchStartY = 0;

function onTouchStart(e: TouchEvent) {
  if (window.scrollY === 0 && e.touches[0]) {
    touchStartY = e.touches[0].clientY;
    isPulling.value = true;
  }
}

function onTouchMove(e: TouchEvent) {
  if (!isPulling.value || !e.touches[0]) return;
  const delta = e.touches[0].clientY - touchStartY;
  if (delta > 0 && window.scrollY === 0) {
    pullDistance.value = Math.min(delta * 0.4, 80);
  }
}

async function onTouchEnd() {
  if (!isPulling.value) return;
  isPulling.value = false;
  if (pullDistance.value >= 60) {
    isRefreshing.value = true;
    await loadDashboard();
    isRefreshing.value = false;
  }
  pullDistance.value = 0;
}

function updateOnlineStatus() {
  if (import.meta.client) {
    syncStatus.value = navigator.onLine ? "online" : "offline";
  }
}

onMounted(() => {
  updateOnlineStatus();
  if (import.meta.client) {
    window.addEventListener("online", () => {
      syncStatus.value = "online";
    });
    window.addEventListener("offline", () => {
      syncStatus.value = "offline";
    });
  }
  loadDashboard();
  refreshOnboarding();
});

async function saveRate() {
  const usd = Number(rateInputUsd.value);
  const eur = rateInputEur.value ? Number(rateInputEur.value) : undefined;
  if (!usd || usd <= 0) {
    rateSaveError.value = "La tasa del dolar debe ser mayor a 0";
    return;
  }
  rateSaving.value = true;
  rateSaveError.value = "";
  try {
    const result = await $api<{ rateBcv: number; rateEur: number | null }>(
      "/api/exchange-rate",
      { method: "POST", body: { rateBcv: usd, rateEur: eur } },
    );
    exchangeRate.value = result.rateBcv;
    euroRate.value = result.rateEur;
    showRateEditor.value = false;
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    rateSaveError.value = fetchError.data?.error ?? "Error guardando tasa";
  } finally {
    rateSaving.value = false;
  }
}

function openRateEditor() {
  rateInputUsd.value = exchangeRate.value?.toFixed(2) ?? "";
  rateInputEur.value = euroRate.value?.toFixed(2) ?? "";
  rateSaveError.value = "";
  showRateEditor.value = true;
}
</script>

<template>
  <div
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- Pull-to-refresh indicator -->
    <div
      v-if="pullDistance > 0 || isRefreshing"
      class="flex items-center justify-center transition-all"
      :style="{ height: `${isRefreshing ? 40 : pullDistance}px` }"
    >
      <div
        class="h-5 w-5 rounded-full border-2 border-nova-primary"
        :class="isRefreshing || pullDistance >= 60 ? 'animate-spin border-t-transparent' : 'opacity-50'"
      />
    </div>

    <!-- Skeleton -->
    <div v-if="isLoading" class="animate-pulse space-y-3">
      <div class="h-7 w-52 rounded-xl bg-white/50" />
      <div class="h-32 rounded-[28px] bg-white/40" />
      <div class="grid grid-cols-3 gap-3">
        <div class="h-24 rounded-[24px] bg-white/40" />
        <div class="h-24 rounded-[24px] bg-white/40" />
        <div class="h-24 rounded-[24px] bg-white/40" />
      </div>
      <div class="h-14 rounded-[20px] bg-white/40" />
    </div>

    <!-- Error -->
    <div v-else-if="loadError" class="card-premium p-8 text-center">
      <p class="text-sm font-semibold text-red-500">{{ loadError }}</p>
      <button
        class="mt-3 text-xs font-bold text-nova-primary underline"
        @click="loadDashboard"
      >
        Reintentar
      </button>
    </div>

    <template v-else>
      <!-- ============================================================ -->
      <!-- SCREEN 1: Header + Hero + Cards + CTA (no scroll needed) -->
      <!-- ============================================================ -->

      <!-- HEADER with rate visible -->
      <div class="mb-3 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight text-gradient">
            {{ greeting }}
          </h1>
          <p class="mt-0.5 text-sm font-medium text-gray-500">
            {{ user?.businessName ?? "Nala" }}
            <button
              class="ml-1 rounded-lg px-1.5 py-0.5 text-xs font-bold transition-spring"
              :class="exchangeRate ? 'bg-green-50 text-green-700' : 'bg-yellow-100 text-yellow-700'"
              @click="openRateEditor"
            >
              {{ exchangeRate ? `Bs.${exchangeRate.toFixed(2)}` : "Tasa?" }}
            </button>
          </p>
        </div>
        <button
          class="text-gray-300 transition-spring hover:text-gray-500"
          @click="loadDashboard"
        >
          <RefreshCw :size="16" />
        </button>
      </div>

      <!-- ONBOARDING (compact, only if incomplete) -->
      <div
        v-if="!onboardingComplete"
        class="mb-3 rounded-[16px] border border-green-200/60 bg-gradient-to-r from-[#F0FDF4] to-[#DCFCE7] px-4 py-3"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-bold text-gray-700">
            Configura tu tienda
          </p>
          <span class="text-[10px] font-bold text-green-600">
            {{ onboardingCompletedCount }}/{{ onboardingSteps.length }}
          </span>
        </div>
        <div class="mt-2 flex gap-1.5">
          <NuxtLink
            v-for="step in onboardingSteps"
            :key="step.id"
            :to="step.complete ? undefined : step.to"
            class="flex h-1.5 flex-1 rounded-full transition-all"
            :class="step.complete ? 'bg-green-500' : 'bg-green-200/50'"
          />
        </div>
      </div>

      <!-- HERO: Sales today -->
      <NuxtLink
        to="/sales/history"
        class="card-lift relative block overflow-hidden rounded-[24px] bg-gradient-to-br from-[#EFECFF] via-[#E2DEFF] to-[#D0CCF9] p-4 shadow-[0_12px_30px_-10px_rgba(208,204,249,0.5)] border border-white/80"
      >
        <div class="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/50 blur-3xl" />
        <div class="relative z-10 flex items-start justify-between">
          <div>
            <p class="text-[12px] font-bold text-gray-600/80">Vendido hoy</p>
            <p class="mt-0.5 text-3xl font-extrabold tracking-tighter text-gradient">
              ${{ todaySales.toFixed(2) }}
            </p>
            <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-gray-600/70">
              <span>{{ todayCount }} venta{{ todayCount !== 1 ? "s" : "" }}</span>
              <span v-if="todayCount > 0">${{ todayAvgTicket.toFixed(2) }} prom</span>
              <span
                v-if="todayProfit !== 0"
                class="rounded-lg px-1.5 py-0.5 text-[10px] font-bold"
                :class="todayProfit >= 0 ? 'bg-green-600/15 text-green-700' : 'bg-red-500/15 text-red-700'"
              >
                {{ todayProfit >= 0 ? "+" : "" }}${{ todayProfit.toFixed(2) }}
              </span>
            </div>
          </div>
          <span
            v-if="trendPercent > 0"
            class="flex items-center gap-1 rounded-2xl px-2.5 py-1 text-xs font-bold shadow-sm"
            :class="trendPositive ? 'bg-white/60 text-green-700' : 'bg-white/60 text-red-700'"
          >
            <component :is="trendPositive ? TrendingUp : TrendingDown" :size="14" />
            {{ trendPercent }}%
          </span>
        </div>
      </NuxtLink>

      <!-- 3 CARDS: Fiado + Stock + Pedidos -->
      <div class="mt-2.5 grid grid-cols-3 gap-2">
        <NuxtLink
          to="/accounts"
          class="card-lift relative overflow-hidden rounded-[18px] border border-white/80 p-2.5"
          :class="receivableTotal > 0 ? 'bg-gradient-to-br from-[#FFF7ED] to-[#FED7AA]' : 'bg-gradient-to-br from-[#F0FDF4] to-[#BBF7D0]'"
        >
          <div class="relative z-10">
            <Wallet :size="14" :class="receivableTotal > 0 ? 'text-orange-500' : 'text-green-600'" />
            <p class="mt-1 text-lg font-extrabold tracking-tight text-gray-900">${{ receivableTotal.toFixed(0) }}</p>
            <p class="text-[10px] font-semibold text-gray-600/70">Fiado</p>
          </div>
        </NuxtLink>

        <NuxtLink
          to="/inventory?status=red"
          class="card-lift relative overflow-hidden rounded-[18px] border border-white/80 p-2.5"
          :class="lowStockCount > 0 ? 'bg-gradient-to-br from-[#FEF2F2] to-[#FECACA]' : 'bg-gradient-to-br from-[#F0FDF4] to-[#BBF7D0]'"
        >
          <div class="relative z-10">
            <Package :size="14" :class="lowStockCount > 0 ? 'text-red-500' : 'text-green-600'" />
            <p class="mt-1 text-lg font-extrabold tracking-tight text-gray-900">{{ lowStockCount }}</p>
            <p class="text-[10px] font-semibold text-gray-600/70">{{ lowStockCount > 0 ? "Stock bajo" : "Stock OK" }}</p>
          </div>
        </NuxtLink>

        <NuxtLink
          to="/orders"
          class="card-lift relative overflow-hidden rounded-[18px] border border-white/80 p-2.5"
          :class="pendingOrdersCount > 0 ? 'bg-gradient-to-br from-[#EEF7FD] to-[#CAE8F8]' : 'bg-gradient-to-br from-[#F0FDF4] to-[#BBF7D0]'"
        >
          <div class="relative z-10">
            <ShoppingBag :size="14" :class="pendingOrdersCount > 0 ? 'text-blue-600' : 'text-green-600'" />
            <p class="mt-1 text-lg font-extrabold tracking-tight text-gray-900">{{ pendingOrdersCount }}</p>
            <p class="text-[10px] font-semibold text-gray-600/70">{{ pendingOrdersCount > 0 ? "Pedidos" : "Sin pedidos" }}</p>
          </div>
        </NuxtLink>
      </div>

      <!-- CTA: Nueva venta (first viewport!) -->
      <NuxtLink
        to="/sales"
        class="dark-pill mt-2.5 flex w-full items-center justify-center gap-2 rounded-[18px] py-3.5 text-center text-[15px] font-extrabold tracking-wide transition-spring"
      >
        <DollarSign :size="18" />
        Nueva venta
      </NuxtLink>

      <!-- ============================================================ -->
      <!-- SCREEN 2: Orders + Cobros + Feed + Chart + Alerts (scroll) -->
      <!-- ============================================================ -->

      <!-- PENDING ORDERS with quick confirm -->
      <div
        v-if="pendingOrders.length > 0"
        class="mt-3 rounded-[18px] border border-blue-200/60 bg-gradient-to-br from-[#EEF7FD] to-[#DBEAFE] p-3.5"
      >
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-bold uppercase tracking-wider text-blue-700">
            Pedidos ({{ pendingOrders.length }})
          </p>
          <NuxtLink to="/orders" class="text-[10px] font-bold text-blue-600 hover:underline">
            Ver todo
          </NuxtLink>
        </div>
        <div class="mt-2 space-y-1.5">
          <div
            v-for="o in pendingOrders"
            :key="o.id"
            class="flex items-center justify-between gap-2 rounded-xl bg-white/60 px-3 py-2"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-[13px] font-bold text-gray-800">{{ o.customerName }}</p>
              <p class="text-[11px] text-gray-500">
                ${{ o.total.toFixed(2) }} · {{ methodLabel[o.paymentMethod] ?? o.paymentMethod }} · {{ timeAgo(o.createdAt) }}
              </p>
            </div>
            <button
              class="flex-shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-[10px] font-bold text-white transition-spring hover:bg-green-700 disabled:opacity-50"
              :disabled="confirmingOrderId === o.id"
              @click="quickConfirmOrder(o.id)"
            >
              {{ confirmingOrderId === o.id ? "..." : "Confirmar" }}
            </button>
          </div>
        </div>
      </div>

      <!-- COBROS PENDIENTES (always visible, even if 0) -->
      <div class="mt-3 rounded-[18px] border border-amber-200/60 bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] p-3.5">
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Cobros {{ dueToday.length > 0 ? `(${dueToday.length})` : "" }}
          </p>
          <NuxtLink to="/accounts" class="text-[10px] font-bold text-amber-600 hover:underline">
            Ver todo
          </NuxtLink>
        </div>
        <div v-if="dueToday.length > 0" class="mt-2 space-y-1.5">
          <div
            v-for="d in dueToday"
            :key="d.id"
            class="flex items-center justify-between gap-2 rounded-xl bg-white/60 px-3 py-2"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-[13px] font-bold text-gray-800">{{ d.customerName }}</p>
              <p class="text-[11px] font-medium text-amber-700">${{ Number(d.balanceUsd).toFixed(2) }}</p>
            </div>
            <a
              v-if="d.customerPhone"
              :href="`https://wa.me/${d.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${d.customerName}, tienes un saldo pendiente de $${Number(d.balanceUsd).toFixed(2)}. ¿Cuando puedes realizar el pago? Gracias!`)}`"
              target="_blank"
              rel="noopener noreferrer"
              class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-green-600 text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
            </a>
          </div>
        </div>
        <p v-else class="mt-1.5 text-[11px] font-medium text-amber-600/70">
          No hay cobros pendientes hoy
        </p>
      </div>

      <!-- WEEKLY CHART (compact) -->
      <NuxtLink
        v-if="weeklyDays.length > 0"
        to="/reports"
        class="card-premium mt-2.5 block p-3.5 transition-spring hover:shadow-[0_8px_20px_-5px_rgba(0,0,0,0.06)]"
      >
        <div class="mb-2 flex items-center justify-between">
          <p class="text-[11px] font-bold text-gray-500 tracking-wide">Ventas 7 dias</p>
          <BarChart3 :size="12" class="text-gray-400" />
        </div>
        <SharedBarChart
          :labels="weeklyDays.map((d) => d.day.slice(0, 2))"
          :data="weeklyDays.map((d) => d.amount)"
          :height="60"
        />
      </NuxtLink>

      <!-- ACTIVITY FEED -->
      <div
        v-if="activityFeed.length > 0"
        class="mt-2.5 rounded-[18px] bg-white/50 p-3.5"
      >
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Actividad reciente
        </p>
        <div class="space-y-1">
          <NuxtLink
            v-for="item in activityFeed"
            :key="item.id"
            :to="item.to ?? '#'"
            class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12px] transition-spring hover:bg-white/60"
          >
            <span class="flex-shrink-0">{{ item.icon }}</span>
            <span class="min-w-0 flex-1 truncate font-medium text-gray-700">{{ item.text }}</span>
            <span class="flex-shrink-0 text-[10px] font-medium text-gray-400">{{ item.time }}</span>
          </NuxtLink>
        </div>
      </div>

      <!-- INSIGHTS ROW: product estrella + alertas -->
      <div class="mt-2.5 grid grid-cols-2 gap-2">
        <div v-if="topProduct" class="card-premium flex items-center gap-2.5 p-3">
          <Star :size="14" class="flex-shrink-0 text-nova-accent" />
          <div class="min-w-0">
            <p class="truncate text-[11px] font-bold text-gray-800">{{ topProduct.name }}</p>
            <p class="text-[10px] font-medium text-gray-400">{{ topProduct.quantity }} uds hoy</p>
          </div>
        </div>
        <NuxtLink
          v-if="dashboardAlerts.length > 0"
          to="/reports"
          class="card-premium flex items-center gap-2.5 p-3 transition-spring"
        >
          <AlertTriangle :size="14" class="flex-shrink-0 text-orange-500" />
          <div class="min-w-0">
            <p class="text-[11px] font-bold text-gray-800">{{ dashboardAlerts.length }} alerta{{ dashboardAlerts.length > 1 ? "s" : "" }}</p>
            <p class="text-[10px] font-medium text-gray-400">Requiere atencion</p>
          </div>
        </NuxtLink>
      </div>

      <!-- SMART ALERTS (actionable, compact) -->
      <div v-if="dashboardAlerts.length > 0" class="mt-2.5 space-y-1.5">
        <NuxtLink
          v-for="alert in dashboardAlerts.slice(0, 3)"
          :key="alert.id"
          :to="alert.actionTo"
          class="flex items-center gap-2.5 rounded-[14px] border border-white/80 px-3 py-2.5 transition-spring"
          :class="{
            'bg-gradient-to-r from-red-50/80 to-red-100/40': alert.severity === 'critical',
            'bg-gradient-to-r from-amber-50/80 to-amber-100/40': alert.severity === 'warning',
            'bg-gradient-to-r from-blue-50/80 to-blue-100/40': alert.severity === 'info',
          }"
        >
          <span class="text-sm flex-shrink-0">{{ alert.icon }}</span>
          <p class="min-w-0 flex-1 truncate text-[11px] font-bold text-gray-800">{{ alert.title }}</p>
          <span
            class="flex-shrink-0 text-[10px] font-bold"
            :class="{
              'text-red-600': alert.severity === 'critical',
              'text-amber-600': alert.severity === 'warning',
              'text-blue-600': alert.severity === 'info',
            }"
          >
            {{ alert.actionLabel }}
          </span>
        </NuxtLink>
      </div>

      <!-- FOOTER: status -->
      <div class="mt-2.5 flex items-center justify-center gap-2 px-1">
        <span
          class="h-1.5 w-1.5 rounded-full"
          :class="{
            'bg-green-500': syncStatus === 'online',
            'bg-gray-400': syncStatus === 'offline',
            'bg-yellow-500 animate-pulse': syncStatus === 'syncing',
          }"
        />
        <span class="text-[10px] font-semibold text-gray-400">
          {{ syncStatus === "online" ? "Actualizado" : syncStatus === "syncing" ? "Sincronizando..." : "Offline" }}
        </span>
      </div>

      <!-- Rate editor modal -->
      <Teleport to="body">
        <div
          v-if="showRateEditor"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          @click.self="showRateEditor = false"
        >
          <div class="glass-strong w-full max-w-sm rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
            <h3 class="mb-5 text-xl font-extrabold tracking-tight text-gradient">
              Tasa de cambio BCV
            </h3>
            <div class="space-y-4">
              <div>
                <label class="mb-1.5 block text-[13px] font-bold text-gray-600">Dolar (USD)</label>
                <input
                  v-model="rateInputUsd"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="86.48"
                  autofocus
                  class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none focus:ring-[3px] focus:ring-nova-accent/20 focus:bg-white transition-spring placeholder:text-gray-400"
                >
              </div>
              <div>
                <label class="mb-1.5 block text-[13px] font-bold text-gray-600">Euro (EUR)</label>
                <input
                  v-model="rateInputEur"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="96.20"
                  class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none focus:ring-[3px] focus:ring-nova-accent/20 focus:bg-white transition-spring placeholder:text-gray-400"
                >
              </div>
            </div>
            <p v-if="rateSaveError" class="mt-3 text-sm font-semibold text-red-500">{{ rateSaveError }}</p>
            <p class="mt-3 text-[10px] font-semibold text-gray-400">
              Consulta la tasa oficial en bcv.org.ve
            </p>
            <div class="mt-5 flex gap-3">
              <button
                class="glass flex-1 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
                @click="showRateEditor = false"
              >
                Cancelar
              </button>
              <button
                class="dark-pill flex-1 rounded-2xl py-3 text-sm font-bold transition-spring disabled:opacity-50"
                :disabled="rateSaving"
                @click="saveRate"
              >
                {{ rateSaving ? "Guardando..." : "Guardar" }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>
