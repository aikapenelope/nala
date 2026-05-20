<script setup lang="ts">
/**
 * Dashboard - data-rich, single screen with weekly chart.
 *
 * Shows: sales hero, 3 summary cards, weekly bar chart, payment mix,
 * 4 insight tiles (seller, product, alerts, margin), CTA.
 *
 * Connected to:
 * - GET /api/reports/daily (sales, profit, topProducts, salesByMethod)
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
  DollarSign,
  Package,
  ShoppingBag,
  Wallet,
  RefreshCw,
} from "lucide-vue-next";
import { currentHourVET } from "@nova/shared";

/**
 * Keep this page alive in memory when navigating away.
 * On return, the component is reactivated instantly (no re-render, no re-fetch).
 * Data refreshes automatically if stale (>5 minutes old).
 */
definePageMeta({ keepalive: true });

const { user } = useNovaAuth();
const { $api } = useApi();
const { pendingCount: pendingOrdersCount } = useOrdersBadge();
const {
  steps: onboardingSteps,
  allComplete: onboardingComplete,
  completedCount: onboardingCompletedCount,
  refresh: refreshOnboarding,
} = useOnboardingChecklist();
const { isOpen: cashIsOpen, checkOpenStatus } = useCashStatus();

const isLoading = ref(true);
const loadError = ref("");
const lastUpdatedAt = ref<Date | null>(null);

/** Daily data. */
const todaySales = ref(0);
const todayCount = ref(0);
const todayAvgTicket = ref(0);
const todayProfit = ref(0);
const trendPercent = ref(0);
const trendPositive = ref(true);
const topProduct = ref<{ name: string; quantity: number } | null>(null);
const topProducts = ref<Array<{ name: string; quantity: number }>>([]);
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
  createdAt?: string;
}
const dueToday = ref<DueReceivable[]>([]);

/** Sync status. */
const syncStatus = ref<"online" | "offline" | "syncing">("online");

/** Store online status. */
const storeOnline = ref<boolean | null>(null);
const storeOrdersWeek = ref(0);
const storeRevenueWeek = ref(0);

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
  return new Date(dateStr).toLocaleDateString("es-VE", { timeZone: "America/Caracas", day: "numeric", month: "short" });
}

const greeting = computed(() => {
  const hour = currentHourVET();
  if (hour < 12) return "Buenos dias";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
});

/**
 * Load all dashboard data via the consolidated endpoint.
 * Single API call replaces 12 parallel calls — server handles parallelism.
 */
let loadInProgress = false;
async function loadDashboard() {
  if (loadInProgress) return;
  loadInProgress = true;
  isLoading.value = true;
  loadError.value = "";

  try {
    const data = await $api<{
      today: {
        totalSales: number;
        totalCount: number;
        avgTicket: number;
        totalProfit: number;
        vsSameDayLastWeek: number;
        topProducts: Array<{ name: string; quantity: number }>;
        salesByMethod: Record<string, number>;
      } | null;
      weekly: { dailyBreakdown: Array<{ day: string; amount: number }> } | null;
      financial: { grossMargin: number } | null;
      receivable: { totalPending: number; accounts: DueReceivable[] } | null;
      inventory: { lowStock: number; criticalStock: number } | null;
      alerts: SmartAlert[];
      cashFlow: { projection7d: { net: number } } | null;
      exchangeRate: { rateBcv: number; rateEur: number | null } | null;
      orders: { pending: PendingOrder[]; pendingCount: number } | null;
      recentSales: Array<{ id: string; totalUsd: string; channel: string; createdAt: string }>;
      store: { enabled: boolean; ordersThisWeek: number; revenueThisWeek: number } | null;
    }>("/api/dashboard");

    // Daily sales
    if (data.today) {
      todaySales.value = data.today.totalSales;
      todayCount.value = data.today.totalCount;
      todayAvgTicket.value = data.today.avgTicket;
      todayProfit.value = data.today.totalProfit;
      trendPercent.value = Math.abs(data.today.vsSameDayLastWeek);
      trendPositive.value = data.today.vsSameDayLastWeek >= 0;
      topProduct.value = data.today.topProducts?.[0] ?? null;
      topProducts.value = data.today.topProducts?.slice(0, 3) ?? [];
      salesByMethod.value = data.today.salesByMethod ?? {};
    }

    // Weekly chart
    if (data.weekly) {
      weeklyDays.value = data.weekly.dailyBreakdown;
    }

    // Financial
    if (data.financial) {
      grossMargin.value = data.financial.grossMargin;
    }

    // Receivables
    if (data.receivable) {
      receivableTotal.value = data.receivable.totalPending;

      const today = new Date();
      const fifteenDaysAgo = new Date(today);
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      today.setHours(23, 59, 59, 999);

      dueToday.value = (data.receivable.accounts ?? [])
        .filter((a) => {
          if (a.dueDate && new Date(a.dueDate) <= today) return true;
          if (!a.dueDate && a.createdAt && new Date(a.createdAt) <= fifteenDaysAgo) return true;
          return false;
        })
        .slice(0, 5);
    }

    // Inventory
    if (data.inventory) {
      lowStockCount.value = (data.inventory.lowStock ?? 0) + (data.inventory.criticalStock ?? 0);
    }

    // Alerts
    dashboardAlerts.value = (data.alerts ?? []).slice(0, 5);

    // Exchange rate
    if (data.exchangeRate) {
      exchangeRate.value = data.exchangeRate.rateBcv;
      euroRate.value = data.exchangeRate.rateEur;
    }

    // Cash flow
    if (data.cashFlow) {
      cashFlow7d.value = data.cashFlow.projection7d.net;
    }

    // Pending orders
    if (data.orders) {
      pendingOrders.value = data.orders.pending.slice(0, 5);
    }

    // Activity feed (from recent sales + pending orders)
    const feed: FeedItem[] = [];
    for (const order of pendingOrders.value.slice(0, 2)) {
      feed.push({
        id: `order-${order.id}`,
        icon: "📦",
        text: `Pedido de ${order.customerName} $${order.total.toFixed(2)}`,
        time: timeAgo(order.createdAt),
        to: "/orders",
      });
    }
    for (const sale of data.recentSales.slice(0, 5)) {
      const channelLabel = sale.channel === "pos" ? "POS" : sale.channel === "online" ? "Online" : sale.channel;
      feed.push({
        id: `sale-${sale.id}`,
        icon: "💰",
        text: `Venta ${channelLabel} $${Number(sale.totalUsd).toFixed(2)}`,
        time: timeAgo(sale.createdAt),
        to: `/sales/history`,
      });
    }
    activityFeed.value = feed.slice(0, 7);

    // Store
    if (data.store) {
      storeOnline.value = data.store.enabled;
      storeOrdersWeek.value = data.store.ordersThisWeek;
      storeRevenueWeek.value = data.store.revenueThisWeek;
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando dashboard";
    loadError.value = message;
  } finally {
    isLoading.value = false;
    loadInProgress = false;
    lastUpdatedAt.value = new Date();
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
  checkOpenStatus();
});

/**
 * KeepAlive reactivation: refresh data if stale (>5 minutes).
 * This fires when the user navigates BACK to the dashboard.
 * If data is fresh, the page appears instantly without any fetch.
 */
const STALE_THRESHOLD_MS = 5 * 60 * 1000;
onActivated(() => {
  if (lastUpdatedAt.value) {
    const age = Date.now() - lastUpdatedAt.value.getTime();
    if (age > STALE_THRESHOLD_MS) {
      loadDashboard();
    }
  }
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

    <!-- Skeleton: mirrors the real dashboard layout for zero CLS -->
    <div v-if="isLoading" class="animate-pulse space-y-3">
      <!-- Header: greeting + rate badge -->
      <div class="flex items-center justify-between">
        <div>
          <div class="h-7 w-40 rounded-xl bg-white/50" />
          <div class="mt-1.5 h-4 w-28 rounded-lg bg-white/40" />
        </div>
        <div class="h-8 w-8 rounded-full bg-white/40" />
      </div>
      <!-- Hero sales card -->
      <div class="h-[140px] rounded-[28px] bg-white/40" />
      <!-- 3 summary cards -->
      <div class="grid grid-cols-3 gap-2.5">
        <div class="h-[88px] rounded-[24px] bg-white/40" />
        <div class="h-[88px] rounded-[24px] bg-white/40" />
        <div class="h-[88px] rounded-[24px] bg-white/40" />
      </div>
      <!-- CTA button -->
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
        <div class="flex items-center gap-2">
          <span
            v-if="lastUpdatedAt"
            class="text-[10px] font-medium text-gray-300"
          >
            {{ lastUpdatedAt.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Caracas" }) }}
          </span>
          <button
            class="text-gray-300 transition-spring hover:text-gray-500"
            @click="loadDashboard"
          >
            <RefreshCw :size="16" />
          </button>
        </div>
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

      <!-- CASH REGISTER STATUS -->
      <NuxtLink
        v-if="cashIsOpen !== null"
        :to="cashIsOpen ? '/accounts/day-close' : '/accounts/cash-opening'"
        class="mb-2.5 flex items-center gap-2 rounded-[14px] px-3.5 py-2 text-[12px] font-bold transition-spring"
        :class="cashIsOpen ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'"
      >
        <span class="h-2 w-2 rounded-full" :class="cashIsOpen ? 'bg-green-500' : 'bg-amber-500'" />
        {{ cashIsOpen ? "Caja abierta" : "Caja cerrada" }}
        <span class="ml-auto text-[10px] font-medium opacity-70">
          {{ cashIsOpen ? "Cerrar caja" : "Abrir caja" }} →
        </span>
      </NuxtLink>

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

      <!-- EMPTY STATE: No sales today (motivational for new businesses) -->
      <div
        v-if="todayCount === 0 && !isLoading"
        class="mt-2.5 rounded-[18px] border border-dashed border-gray-200 bg-white/40 p-5 text-center"
      >
        <p class="text-sm font-bold text-gray-700">Sin ventas hoy</p>
        <p class="mt-1 text-xs text-gray-400">
          Registra tu primera venta y Nala organiza todo automaticamente.
        </p>
        <NuxtLink
          to="/sales"
          class="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-nova-primary/10 px-4 py-2 text-xs font-bold text-nova-primary transition-spring hover:bg-nova-primary/20"
        >
          <DollarSign :size="14" />
          Registrar venta
        </NuxtLink>
      </div>

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

      <!-- BELOW-THE-FOLD: lazy-loaded for faster first paint -->
      <LazyDashboardBelowFold
        :gross-margin="grossMargin"
        :cash-flow7d="cashFlow7d"
        :sales-by-method="salesByMethod"
        :today-count="todayCount"
        :store-online="storeOnline"
        :store-orders-week="storeOrdersWeek"
        :store-revenue-week="storeRevenueWeek"
        :pending-orders="pendingOrders"
        :pending-orders-count="pendingOrdersCount"
        :due-today="dueToday"
        :weekly-days="weeklyDays"
        :activity-feed="activityFeed"
        :top-products="topProducts"
        :top-product="topProduct"
        :dashboard-alerts="dashboardAlerts"
        :sync-status="syncStatus"
        :confirming-order-id="confirmingOrderId"
        @confirm-order="quickConfirmOrder"
      />

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
