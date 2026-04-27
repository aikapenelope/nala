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
  CreditCard,
  Trophy,
  Star,
  Wallet,
  RefreshCw,
  BarChart3,
  UserPlus,
  Upload,
  ClipboardList,
} from "lucide-vue-next";

const { isAdmin, user } = useNovaAuth();
const { $api } = useApi();

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

/** Sync status. */
const syncStatus = ref<"online" | "offline" | "syncing">("online");
const pendingSyncCount = ref(0);

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos dias";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
});

/** Payment method config with colors. */
const methodConfig: Record<
  string,
  { label: string; from: string; to: string }
> = {
  efectivo: { label: "Efectivo", from: "#4ade80", to: "#16a34a" },
  pago_movil: { label: "Movil", from: "#60a5fa", to: "#2563eb" },
  binance: { label: "Binance", from: "#fbbf24", to: "#d97706" },
  zinli: { label: "Zinli", from: "#a78bfa", to: "#7c3aed" },
  transferencia: { label: "Transf.", from: "#38bdf8", to: "#0284c7" },
  zelle: { label: "Zelle", from: "#818cf8", to: "#4f46e5" },
  fiado: { label: "Fiado", from: "#fb923c", to: "#ea580c" },
};

const topMethods = computed(() => {
  const entries = Object.entries(salesByMethod.value);
  if (entries.length === 0) return [];
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) return [];
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([method, amount]) => ({
      label: methodConfig[method]?.label ?? method,
      from: methodConfig[method]?.from ?? "#9ca3af",
      to: methodConfig[method]?.to ?? "#6b7280",
      percent: Math.round((amount / total) * 100),
      amount: Math.round(amount * 100) / 100,
    }));
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

      $api<{ totalPending: number }>("/api/accounts/receivable"),

      $api<{ data: { lowStock: number; criticalStock: number } }>(
        "/api/reports/inventory",
      ),

      $api<{ alerts: SmartAlert[] }>("/api/reports/alerts"),

      $api<{ rateBcv: number; rateEur: number | null }>("/api/exchange-rate"),

      $api<{ data: { projection7d: { net: number } } }>(
        "/api/reports/cash-flow",
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
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando dashboard";
    loadError.value = message;
  } finally {
    isLoading.value = false;
    loadInProgress = false;
  }
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
  <div>
    <!-- Skeleton -->
    <div v-if="isLoading" class="animate-pulse space-y-3">
      <div class="h-7 w-52 rounded-xl bg-white/50" />
      <div class="h-32 rounded-[28px] bg-white/40" />
      <div class="grid grid-cols-3 gap-3">
        <div class="h-24 rounded-[24px] bg-white/40" />
        <div class="h-24 rounded-[24px] bg-white/40" />
        <div class="h-24 rounded-[24px] bg-white/40" />
      </div>
      <div class="h-28 rounded-[24px] bg-white/40" />
      <div class="h-20 rounded-[24px] bg-white/40" />
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
      <!-- HEADER -->
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight text-gradient">
            {{ greeting }}
          </h1>
          <p class="mt-0.5 text-sm font-medium text-gray-500">
            {{ user?.businessName ?? "Nova" }}
            <span class="text-gray-300"> · </span>
            {{ user?.name ?? "" }}
          </p>
        </div>
        <button
          v-if="isAdmin"
          class="rounded-2xl px-4 py-2 text-xs font-bold transition-spring"
          :class="
            exchangeRate
              ? 'glass text-gray-700'
              : 'bg-yellow-100 text-yellow-700'
          "
          @click="openRateEditor"
        >
          <template v-if="exchangeRate"
            >Bs.{{ exchangeRate.toFixed(2) }}</template
          >
          <template v-else>Configurar tasa</template>
        </button>
        <span
          v-else-if="exchangeRate"
          class="glass rounded-2xl px-4 py-2 text-xs font-bold text-gray-500"
        >
          Bs.{{ exchangeRate.toFixed(2) }}
        </span>
      </div>

      <!-- HERO: Sales + Profit -->
      <NuxtLink
        to="/sales/history"
        class="card-lift relative block overflow-hidden rounded-[28px] bg-gradient-to-br from-[#EFECFF] via-[#E2DEFF] to-[#D0CCF9] p-5 shadow-[0_15px_35px_-10px_rgba(208,204,249,0.5)] border border-white/80"
      >
        <div
          class="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/50 blur-3xl"
        />
        <div
          class="absolute bottom-0 left-0 h-20 w-20 rounded-full bg-[#a78bfa]/20 blur-2xl"
        />
        <div class="relative z-10 flex items-start justify-between">
          <div>
            <p class="text-[13px] font-bold text-gray-600/80">Vendido hoy</p>
            <p
              class="mt-0.5 text-4xl font-extrabold tracking-tighter text-gradient"
            >
              ${{ todaySales.toFixed(2) }}
            </p>
            <div
              class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-gray-600/70"
            >
              <span
                >{{ todayCount }} venta{{ todayCount !== 1 ? "s" : "" }}</span
              >
              <span v-if="todayCount > 0"
                >${{ todayAvgTicket.toFixed(2) }} prom</span
              >
              <span
                v-if="todayProfit !== 0"
                class="rounded-lg px-1.5 py-0.5 text-[11px] font-bold"
                :class="
                  todayProfit >= 0
                    ? 'bg-green-600/15 text-green-700'
                    : 'bg-red-500/15 text-red-700'
                "
              >
                {{ todayProfit >= 0 ? "+" : "" }}${{ todayProfit.toFixed(2) }}
              </span>
            </div>
          </div>
          <span
            v-if="trendPercent > 0"
            class="flex items-center gap-1 rounded-2xl px-3 py-1.5 text-xs font-bold shadow-sm"
            :class="
              trendPositive
                ? 'bg-white/60 text-green-700'
                : 'bg-white/60 text-red-700'
            "
          >
            <component
              :is="trendPositive ? TrendingUp : TrendingDown"
              :size="14"
            />
            {{ trendPercent }}%
          </span>
        </div>
      </NuxtLink>

      <!-- 3 CARDS -->
      <div class="mt-3 grid grid-cols-3 gap-2.5 overflow-hidden">
        <NuxtLink
          to="/accounts"
          class="card-lift relative overflow-hidden rounded-[20px] border border-white/80 p-3"
          :class="
            receivableTotal > 0
              ? 'bg-gradient-to-br from-[#FFF7ED] to-[#FED7AA]'
              : 'bg-gradient-to-br from-[#F0FDF4] to-[#BBF7D0]'
          "
        >
          <div
            class="absolute -top-3 -right-3 h-10 w-10 rounded-full bg-white/40 blur-lg"
          />
          <div class="relative z-10">
            <div
              class="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg"
              :class="receivableTotal > 0 ? 'dark-pill' : 'bg-green-600/20'"
            >
              <Wallet
                :size="14"
                :class="
                  receivableTotal > 0 ? 'text-orange-300' : 'text-green-600'
                "
              />
            </div>
            <p class="text-lg font-extrabold tracking-tight text-gray-900">
              ${{ receivableTotal.toFixed(0) }}
            </p>
            <p class="text-[10px] font-semibold text-gray-600/70">Te deben</p>
          </div>
        </NuxtLink>

        <NuxtLink
          to="/inventory?status=red"
          class="card-lift relative overflow-hidden rounded-[20px] border border-white/80 p-3"
          :class="
            lowStockCount > 0
              ? 'bg-gradient-to-br from-[#FEF2F2] to-[#FECACA]'
              : 'bg-gradient-to-br from-[#F0FDF4] to-[#BBF7D0]'
          "
        >
          <div
            class="absolute -top-3 -right-3 h-10 w-10 rounded-full bg-white/40 blur-lg"
          />
          <div class="relative z-10">
            <div
              class="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg"
              :class="lowStockCount > 0 ? 'dark-pill' : 'bg-green-600/20'"
            >
              <Package
                :size="14"
                :class="lowStockCount > 0 ? 'text-red-300' : 'text-green-600'"
              />
            </div>
            <p class="text-lg font-extrabold tracking-tight text-gray-900">
              {{ lowStockCount }}
            </p>
            <p class="text-[10px] font-semibold text-gray-600/70">
              {{ lowStockCount > 0 ? "Se acaban" : "Stock OK" }}
            </p>
          </div>
        </NuxtLink>

        <NuxtLink
          to="/reports/cash-flow"
          class="card-lift relative overflow-hidden rounded-[20px] border border-white/80 p-3"
          :class="
            cashFlow7d >= 0
              ? 'bg-gradient-to-br from-[#EEF7FD] to-[#CAE8F8]'
              : 'bg-gradient-to-br from-[#FEF2F2] to-[#FECACA]'
          "
        >
          <div
            class="absolute -top-3 -right-3 h-10 w-10 rounded-full bg-white/40 blur-lg"
          />
          <div class="relative z-10">
            <div
              class="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg"
              :class="cashFlow7d >= 0 ? 'bg-blue-600/15' : 'dark-pill'"
            >
              <CreditCard
                :size="14"
                :class="cashFlow7d >= 0 ? 'text-blue-600' : 'text-red-300'"
              />
            </div>
            <p
              class="text-lg font-extrabold tracking-tight"
              :class="cashFlow7d >= 0 ? 'text-gray-900' : 'text-red-700'"
            >
              {{ cashFlow7d >= 0 ? "+" : "" }}${{
                Math.abs(cashFlow7d).toFixed(0)
              }}
            </p>
            <p class="text-[10px] font-semibold text-gray-600/70">En 7 dias</p>
          </div>
        </NuxtLink>
      </div>

      <!-- WEEKLY CHART -->
      <NuxtLink
        v-if="weeklyDays.length > 0"
        to="/reports/weekly"
        class="card-premium mt-3 block p-4 transition-spring hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.08)]"
      >
        <div class="mb-3 flex items-center justify-between">
          <p class="text-[12px] font-bold text-gray-500 tracking-wide">
            Ventas 7 dias
          </p>
          <BarChart3 :size="14" class="text-gray-400" />
        </div>
        <SharedBarChart
          :labels="weeklyDays.map((d) => d.day.slice(0, 2))"
          :data="weeklyDays.map((d) => d.amount)"
          :height="80"
        />
      </NuxtLink>

      <!-- PAYMENT MIX -->
      <div
        v-if="topMethods.length > 0"
        class="glass mt-3 rounded-[20px] px-4 py-3"
      >
        <p class="mb-2 text-[11px] font-bold text-gray-500 tracking-wide">
          Metodos de pago hoy
        </p>
        <div class="space-y-1.5">
          <div
            v-for="m in topMethods"
            :key="m.label"
            class="flex items-center gap-2.5"
          >
            <span class="w-12 text-[10px] font-bold text-gray-600">{{
              m.label
            }}</span>
            <div
              class="h-2 flex-1 overflow-hidden rounded-full bg-gray-100/80 border border-white"
            >
              <div
                class="progress-glow h-full rounded-full"
                :style="{
                  width: `${m.percent}%`,
                  background: `linear-gradient(to right, ${m.from}, ${m.to})`,
                }"
              />
            </div>
            <span
              class="w-14 text-right text-[10px] font-extrabold text-gray-700"
            >
              ${{ m.amount.toFixed(0) }}
              <span class="text-gray-400">{{ m.percent }}%</span>
            </span>
          </div>
        </div>
      </div>

      <!-- 4 INSIGHT TILES -->
      <div class="mt-3 grid grid-cols-2 gap-2.5">
        <!-- Top seller -->
        <div
          v-if="topSeller"
          class="card-premium flex items-center gap-3 p-3.5"
        >
          <div
            class="dark-pill flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px]"
          >
            <Trophy
              :size="16"
              class="text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.6)]"
            />
          </div>
          <div class="min-w-0">
            <p class="truncate text-[12px] font-extrabold text-gray-800">
              {{ topSeller.name }}
            </p>
            <p class="text-[11px] font-bold text-gray-400">
              ${{ topSeller.total.toFixed(0) }} vendido
            </p>
          </div>
        </div>

        <!-- Star product -->
        <div
          v-if="topProduct"
          class="card-premium flex items-center gap-3 p-3.5"
        >
          <div
            class="dark-pill flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px]"
          >
            <Star
              :size="16"
              class="text-blue-300 drop-shadow-[0_0_6px_rgba(147,197,253,0.6)]"
            />
          </div>
          <div class="min-w-0">
            <p class="truncate text-[12px] font-extrabold text-gray-800">
              {{ topProduct.name }}
            </p>
            <p class="text-[11px] font-bold text-gray-400">
              {{ topProduct.quantity }} uds hoy
            </p>
          </div>
        </div>

        <!-- Alerts count tile (links to full alerts page) -->
        <NuxtLink
          v-if="dashboardAlerts.length > 0"
          to="/reports"
          class="card-premium flex items-center gap-3 p-3.5 transition-spring hover:shadow-[0_8px_20px_-5px_rgba(0,0,0,0.06)]"
        >
          <div
            class="dark-pill flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px]"
          >
            <AlertTriangle
              :size="16"
              class="text-orange-300 drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]"
            />
          </div>
          <div class="min-w-0">
            <p class="text-[12px] font-extrabold text-gray-800">
              {{ dashboardAlerts.length }} alerta{{
                dashboardAlerts.length > 1 ? "s" : ""
              }}
            </p>
            <p class="text-[11px] font-bold text-gray-400">Requiere atencion</p>
          </div>
        </NuxtLink>

        <!-- Gross margin -->
        <NuxtLink
          v-if="grossMargin > 0"
          to="/reports/financial"
          class="card-premium flex items-center gap-3 p-3.5 transition-spring hover:shadow-[0_8px_20px_-5px_rgba(0,0,0,0.06)]"
        >
          <div
            class="dark-pill flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px]"
          >
            <BarChart3
              :size="16"
              class="text-green-300 drop-shadow-[0_0_6px_rgba(134,239,172,0.6)]"
            />
          </div>
          <div class="min-w-0">
            <p class="text-[12px] font-extrabold text-gray-800">
              {{ grossMargin }}% margen
            </p>
            <p class="text-[11px] font-bold text-gray-400">Ganancia bruta</p>
          </div>
        </NuxtLink>
      </div>

      <!-- SMART ALERTS (actionable cards) -->
      <div v-if="dashboardAlerts.length > 0" class="mt-3 space-y-2">
        <p
          class="px-1 text-[11px] font-bold tracking-wider text-gray-400 uppercase"
        >
          Requiere atencion
        </p>
        <NuxtLink
          v-for="alert in dashboardAlerts"
          :key="alert.id"
          :to="alert.actionTo"
          class="card-lift flex items-center gap-3 rounded-[18px] border border-white/80 p-3.5 transition-spring"
          :class="{
            'bg-gradient-to-r from-red-50/80 to-red-100/40':
              alert.severity === 'critical',
            'bg-gradient-to-r from-amber-50/80 to-amber-100/40':
              alert.severity === 'warning',
            'bg-gradient-to-r from-blue-50/80 to-blue-100/40':
              alert.severity === 'info',
          }"
        >
          <span class="text-lg flex-shrink-0">{{ alert.icon }}</span>
          <div class="min-w-0 flex-1">
            <p class="text-[12px] font-bold text-gray-800 leading-tight">
              {{ alert.title }}
            </p>
            <p class="mt-0.5 text-[10px] font-semibold text-gray-500">
              {{ alert.suggestion }}
            </p>
          </div>
          <span
            class="flex-shrink-0 rounded-xl px-2.5 py-1 text-[10px] font-bold transition-spring"
            :class="{
              'bg-red-600/10 text-red-700': alert.severity === 'critical',
              'bg-amber-600/10 text-amber-700': alert.severity === 'warning',
              'bg-blue-600/10 text-blue-700': alert.severity === 'info',
            }"
          >
            {{ alert.actionLabel }}
          </span>
        </NuxtLink>
      </div>

      <!-- CTA -->
      <NuxtLink
        to="/sales"
        class="dark-pill mt-3 flex w-full items-center justify-center gap-2.5 rounded-[20px] py-4 text-center text-[15px] font-extrabold tracking-wide transition-spring"
      >
        <DollarSign :size="20" />
        Nueva venta
      </NuxtLink>

      <!-- QUICK ACTIONS -->
      <div v-if="isAdmin" class="mt-3 grid grid-cols-4 gap-2">
        <NuxtLink
          to="/inventory/new"
          class="card-premium flex flex-col items-center gap-1.5 p-3 transition-spring hover:shadow-[0_8px_20px_-5px_rgba(0,0,0,0.06)]"
        >
          <Package :size="18" class="text-gray-500" />
          <span class="text-[10px] font-bold text-gray-600">Producto</span>
        </NuxtLink>
        <NuxtLink
          to="/inventory/import"
          class="card-premium flex flex-col items-center gap-1.5 p-3 transition-spring hover:shadow-[0_8px_20px_-5px_rgba(0,0,0,0.06)]"
        >
          <Upload :size="18" class="text-gray-500" />
          <span class="text-[10px] font-bold text-gray-600">Importar</span>
        </NuxtLink>
        <NuxtLink
          to="/clients/new"
          class="card-premium flex flex-col items-center gap-1.5 p-3 transition-spring hover:shadow-[0_8px_20px_-5px_rgba(0,0,0,0.06)]"
        >
          <UserPlus :size="18" class="text-gray-500" />
          <span class="text-[10px] font-bold text-gray-600">Cliente</span>
        </NuxtLink>
        <NuxtLink
          to="/sales/quotations"
          class="card-premium flex flex-col items-center gap-1.5 p-3 transition-spring hover:shadow-[0_8px_20px_-5px_rgba(0,0,0,0.06)]"
        >
          <ClipboardList :size="18" class="text-gray-500" />
          <span class="text-[10px] font-bold text-gray-600">Cotizar</span>
        </NuxtLink>
      </div>

      <!-- FOOTER -->
      <div class="mt-2.5 flex items-center justify-between px-1">
        <div class="flex items-center gap-2">
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="{
              'bg-green-500': syncStatus === 'online',
              'bg-gray-400': syncStatus === 'offline',
              'bg-yellow-500 animate-pulse': syncStatus === 'syncing',
            }"
          />
          <span class="text-[10px] font-semibold text-gray-400">
            <template v-if="syncStatus === 'online'">Actualizado</template>
            <template v-else-if="syncStatus === 'syncing'"
              >Sincronizando...</template
            >
            <template v-else>
              Offline
              <template v-if="pendingSyncCount > 0">
                · {{ pendingSyncCount }}</template
              >
            </template>
          </span>
        </div>
        <button
          class="text-gray-300 transition-spring hover:text-gray-500 hover:scale-110"
          @click="loadDashboard"
        >
          <RefreshCw :size="13" />
        </button>
      </div>

      <!-- Rate editor modal -->
      <Teleport to="body">
        <div
          v-if="showRateEditor"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          @click.self="showRateEditor = false"
        >
          <div
            class="glass-strong w-full max-w-sm rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]"
          >
            <h3
              class="mb-5 text-xl font-extrabold tracking-tight text-gradient"
            >
              Tasa de cambio BCV
            </h3>
            <div class="space-y-4">
              <div>
                <label class="mb-1.5 block text-[13px] font-bold text-gray-600"
                  >Dolar (USD)</label
                >
                <input
                  v-model="rateInputUsd"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="86.48"
                  autofocus
                  class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none focus:ring-[3px] focus:ring-nova-accent/20 focus:bg-white transition-spring placeholder:text-gray-400"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-[13px] font-bold text-gray-600"
                  >Euro (EUR)</label
                >
                <input
                  v-model="rateInputEur"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="96.20"
                  class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none focus:ring-[3px] focus:ring-nova-accent/20 focus:bg-white transition-spring placeholder:text-gray-400"
                />
              </div>
            </div>
            <p
              v-if="rateSaveError"
              class="mt-3 text-sm font-semibold text-red-500"
            >
              {{ rateSaveError }}
            </p>
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
