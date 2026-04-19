<script setup lang="ts">
/**
 * Dashboard - premium glassmorphism design, single screen, zero scroll.
 *
 * Visual language: glass cards, dark accent pills, gradient text,
 * spring animations, progress bars with glow. Adapted from EdTech
 * reference design for mobile-first POS.
 *
 * Connected to:
 * - GET /api/reports/daily (sales, profit, topSeller, topProducts, salesByMethod)
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
} from "lucide-vue-next";

const { isAdmin, user } = useNovaAuth();
const { $api } = useApi();

/** Loading and error state. */
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

/** Summary cards. */
const receivableTotal = ref(0);
const lowStockCount = ref(0);
const cashFlow7d = ref(0);

/** Alerts count. */
const alertCount = ref(0);

/** Exchange rate. */
const exchangeRate = ref<number | null>(null);
const euroRate = ref<number | null>(null);
const showRateEditor = ref(false);
const rateInputUsd = ref("");
const rateInputEur = ref("");
const rateSaving = ref(false);
const rateSaveError = ref("");

/** Cash opening status. */
const cashOpened = ref<boolean | null>(null);

/** Sync status. */
const syncStatus = ref<"online" | "offline" | "syncing">("online");
const pendingSyncCount = ref(0);

/** Time-of-day greeting. */
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos dias";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
});

/** Payment method config with colors. */
const methodConfig: Record<string, { label: string; color: string }> = {
  efectivo: { label: "Efectivo", color: "from-[#4ade80] to-[#16a34a]" },
  pago_movil: { label: "Movil", color: "from-[#60a5fa] to-[#2563eb]" },
  binance: { label: "Binance", color: "from-[#fbbf24] to-[#d97706]" },
  zinli: { label: "Zinli", color: "from-[#a78bfa] to-[#7c3aed]" },
  transferencia: { label: "Transf.", color: "from-[#38bdf8] to-[#0284c7]" },
  zelle: { label: "Zelle", color: "from-[#818cf8] to-[#4f46e5]" },
  fiado: { label: "Fiado", color: "from-[#fb923c] to-[#ea580c]" },
};

/** Top 4 payment methods by amount with colors. */
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
      color: methodConfig[method]?.color ?? "from-gray-400 to-gray-500",
      percent: Math.round((amount / total) * 100),
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
      receivableResult,
      inventoryResult,
      alertsResult,
      rateResult,
      cashFlowResult,
      cashOpenResult,
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

      $api<{ totalPending: number }>("/api/accounts/receivable"),

      $api<{ data: { lowStock: number; criticalStock: number } }>(
        "/api/reports/inventory",
      ),

      $api<{ alerts: unknown[] }>("/api/reports/alerts"),

      $api<{ rateBcv: number; rateEur: number | null }>("/api/exchange-rate"),

      $api<{ data: { projection7d: { net: number } } }>(
        "/api/reports/cash-flow",
      ),

      $api<{ opening: unknown | null }>("/api/cash-opening/latest"),
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

    if (receivableResult.status === "fulfilled") {
      receivableTotal.value = receivableResult.value.totalPending;
    }

    if (inventoryResult.status === "fulfilled") {
      const inv = inventoryResult.value.data;
      lowStockCount.value = (inv.lowStock ?? 0) + (inv.criticalStock ?? 0);
    }

    if (alertsResult.status === "fulfilled") {
      alertCount.value = alertsResult.value.alerts.length;
    }

    if (rateResult.status === "fulfilled") {
      exchangeRate.value = rateResult.value.rateBcv;
      euroRate.value = rateResult.value.rateEur;
    }

    if (cashFlowResult.status === "fulfilled") {
      cashFlow7d.value = cashFlowResult.value.data.projection7d.net;
    }

    if (cashOpenResult.status === "fulfilled") {
      cashOpened.value = cashOpenResult.value.opening !== null;
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
    <!-- ================================================ -->
    <!-- Skeleton loading with glass effect                 -->
    <!-- ================================================ -->
    <div v-if="isLoading" class="animate-pulse space-y-4">
      <div class="h-7 w-52 rounded-xl bg-white/50"/>
      <div class="h-36 rounded-[28px] bg-white/40"/>
      <div class="grid grid-cols-3 gap-3">
        <div class="h-24 rounded-[24px] bg-white/40"/>
        <div class="h-24 rounded-[24px] bg-white/40"/>
        <div class="h-24 rounded-[24px] bg-white/40"/>
      </div>
      <div class="h-14 rounded-[20px] bg-white/40"/>
    </div>

    <!-- Error state -->
    <div
      v-else-if="loadError"
      class="card-premium p-8 text-center"
    >
      <p class="text-sm font-semibold text-red-500">{{ loadError }}</p>
      <button
        class="mt-3 text-xs font-bold text-nova-primary underline"
        @click="loadDashboard"
      >
        Reintentar
      </button>
    </div>

    <template v-else>
      <!-- ================================================ -->
      <!-- HEADER: Greeting + Rate + Cash status             -->
      <!-- ================================================ -->
      <div class="mb-5 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight text-gradient">
            {{ greeting }}
          </h1>
          <p class="mt-0.5 text-sm font-medium text-gray-500">
            {{ user?.businessName ?? "Nova" }}
            <span class="text-gray-300"> · </span>
            {{ user?.name ?? "" }}
            <span
              v-if="isAdmin && cashOpened === false"
              class="ml-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700"
            >
              Caja sin abrir
            </span>
          </p>
        </div>
        <!-- BCV rate pill -->
        <button
          v-if="isAdmin"
          class="rounded-2xl px-4 py-2 text-xs font-bold transition-spring"
          :class="
            exchangeRate
              ? 'glass text-gray-700 hover:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.08)]'
              : 'bg-yellow-100 text-yellow-700'
          "
          @click="openRateEditor"
        >
          <template v-if="exchangeRate">
            Bs.{{ exchangeRate.toFixed(2) }}
          </template>
          <template v-else>Configurar tasa</template>
        </button>
        <span
          v-else-if="exchangeRate"
          class="glass rounded-2xl px-4 py-2 text-xs font-bold text-gray-500"
        >
          Bs.{{ exchangeRate.toFixed(2) }}
        </span>
      </div>

      <!-- ================================================ -->
      <!-- HERO: Today's sales - gradient card                -->
      <!-- ================================================ -->
      <NuxtLink
        to="/sales/history"
        class="card-lift relative block overflow-hidden rounded-[28px] bg-gradient-to-br from-[#ecfdf5] via-[#d1fae5] to-[#a7f3d0] p-6 shadow-[0_15px_35px_-10px_rgba(167,243,208,0.5)] border border-white/80"
      >
        <!-- Decorative orbs -->
        <div class="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/50 blur-3xl"/>
        <div class="absolute bottom-0 left-0 h-20 w-20 rounded-full bg-[#6ee7b7]/20 blur-2xl"/>

        <div class="relative z-10">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm font-bold text-gray-600/80">Vendido hoy</p>
              <p class="mt-1 text-4xl font-extrabold tracking-tighter text-gradient">
                ${{ todaySales.toFixed(2) }}
              </p>
            </div>
            <span
              v-if="trendPercent > 0"
              class="flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-bold shadow-sm"
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

          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-semibold text-gray-600/70">
            <span>{{ todayCount }} venta{{ todayCount !== 1 ? "s" : "" }}</span>
            <span v-if="todayCount > 0">
              ${{ todayAvgTicket.toFixed(2) }} prom
            </span>
            <span
              v-if="todayProfit !== 0"
              class="rounded-xl px-2 py-0.5 text-xs font-bold"
              :class="
                todayProfit >= 0
                  ? 'bg-green-500/15 text-green-700'
                  : 'bg-red-500/15 text-red-700'
              "
            >
              {{ todayProfit >= 0 ? "+" : "" }}${{ todayProfit.toFixed(2) }} ganancia
            </span>
          </div>
        </div>
      </NuxtLink>

      <!-- ================================================ -->
      <!-- 3 CARDS: Gradient backgrounds like course cards    -->
      <!-- ================================================ -->
      <div class="mt-4 grid grid-cols-3 gap-3">
        <!-- Te deben -->
        <NuxtLink
          to="/accounts"
          class="card-lift relative overflow-hidden rounded-[22px] border border-white/80 p-4"
          :class="
            receivableTotal > 0
              ? 'bg-gradient-to-br from-[#FFF7ED] to-[#FED7AA]'
              : 'bg-gradient-to-br from-[#F0FDF4] to-[#BBF7D0]'
          "
        >
          <div class="absolute -top-4 -right-4 h-12 w-12 rounded-full bg-white/40 blur-xl"/>
          <div class="relative z-10">
            <div
              class="mb-2 flex h-9 w-9 items-center justify-center rounded-xl"
              :class="receivableTotal > 0 ? 'dark-pill' : 'bg-green-600/20'"
            >
              <Wallet
                :size="16"
                :class="receivableTotal > 0 ? 'text-orange-300' : 'text-green-600'"
              />
            </div>
            <p class="text-xl font-extrabold tracking-tight text-gray-900">
              ${{ receivableTotal.toFixed(0) }}
            </p>
            <p class="text-[11px] font-semibold text-gray-600/70">Te deben</p>
          </div>
        </NuxtLink>

        <!-- Stock bajo -->
        <NuxtLink
          to="/inventory?status=red"
          class="card-lift relative overflow-hidden rounded-[22px] border border-white/80 p-4"
          :class="
            lowStockCount > 0
              ? 'bg-gradient-to-br from-[#FEF2F2] to-[#FECACA]'
              : 'bg-gradient-to-br from-[#F0FDF4] to-[#BBF7D0]'
          "
        >
          <div class="absolute -top-4 -right-4 h-12 w-12 rounded-full bg-white/40 blur-xl"/>
          <div class="relative z-10">
            <div
              class="mb-2 flex h-9 w-9 items-center justify-center rounded-xl"
              :class="lowStockCount > 0 ? 'dark-pill' : 'bg-green-600/20'"
            >
              <Package
                :size="16"
                :class="lowStockCount > 0 ? 'text-red-300' : 'text-green-600'"
              />
            </div>
            <p class="text-xl font-extrabold tracking-tight text-gray-900">
              {{ lowStockCount }}
            </p>
            <p class="text-[11px] font-semibold text-gray-600/70">
              {{ lowStockCount > 0 ? "Se acaban" : "Stock OK" }}
            </p>
          </div>
        </NuxtLink>

        <!-- Cash flow 7d -->
        <NuxtLink
          to="/reports/cash-flow"
          class="card-lift relative overflow-hidden rounded-[22px] border border-white/80 p-4"
          :class="
            cashFlow7d >= 0
              ? 'bg-gradient-to-br from-[#EEF7FD] to-[#CAE8F8]'
              : 'bg-gradient-to-br from-[#FEF2F2] to-[#FECACA]'
          "
        >
          <div class="absolute -top-4 -right-4 h-12 w-12 rounded-full bg-white/40 blur-xl"/>
          <div class="relative z-10">
            <div
              class="mb-2 flex h-9 w-9 items-center justify-center rounded-xl"
              :class="cashFlow7d >= 0 ? 'bg-blue-600/15' : 'dark-pill'"
            >
              <CreditCard
                :size="16"
                :class="cashFlow7d >= 0 ? 'text-blue-600' : 'text-red-300'"
              />
            </div>
            <p
              class="text-xl font-extrabold tracking-tight"
              :class="cashFlow7d >= 0 ? 'text-gray-900' : 'text-red-700'"
            >
              {{ cashFlow7d >= 0 ? "+" : "" }}${{ Math.abs(cashFlow7d).toFixed(0) }}
            </p>
            <p class="text-[11px] font-semibold text-gray-600/70">En 7 dias</p>
          </div>
        </NuxtLink>
      </div>

      <!-- ================================================ -->
      <!-- INSIGHTS: Dark pill icons + progress style         -->
      <!-- ================================================ -->
      <div class="mt-4 space-y-2.5">
        <!-- Top seller -->
        <div
          v-if="topSeller"
          class="card-premium flex items-center gap-4 p-4 transition-spring hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.08)]"
        >
          <div class="dark-pill flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px]">
            <Trophy :size="20" class="text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.6)]" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[13px] font-extrabold text-gray-800 tracking-wide">
              {{ topSeller.name }} vendio mas
            </p>
            <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100/80 border border-white">
              <div
                class="progress-glow h-full rounded-full bg-gradient-to-r from-[#4ade80] to-[#3b82f6]"
                :style="{ width: todaySales > 0 ? `${Math.min((topSeller.total / todaySales) * 100, 100)}%` : '0%' }"
              />
            </div>
          </div>
          <p class="text-xl font-extrabold tracking-tighter text-gradient">
            ${{ topSeller.total.toFixed(0) }}
          </p>
        </div>

        <!-- Star product -->
        <div
          v-if="topProduct"
          class="card-premium flex items-center gap-4 p-4 transition-spring hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.08)]"
        >
          <div class="dark-pill flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px]">
            <Star :size="20" class="text-blue-300 drop-shadow-[0_0_6px_rgba(147,197,253,0.6)]" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-extrabold text-gray-800 tracking-wide">
              {{ topProduct.name }}
            </p>
            <p class="text-[11px] font-semibold text-gray-400">
              Producto estrella del dia
            </p>
          </div>
          <p class="text-xl font-extrabold tracking-tighter text-gradient">
            {{ topProduct.quantity }}
          </p>
        </div>

        <!-- Alerts -->
        <NuxtLink
          v-if="alertCount > 0"
          to="/reports"
          class="card-premium flex items-center gap-4 p-4 transition-spring hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.08)]"
        >
          <div class="dark-pill flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px]">
            <AlertTriangle :size="20" class="text-orange-300 drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[13px] font-extrabold text-gray-800 tracking-wide">
              {{ alertCount }} alerta{{ alertCount > 1 ? "s" : "" }} pendiente{{ alertCount > 1 ? "s" : "" }}
            </p>
            <p class="text-[11px] font-semibold text-gray-400">
              Requiere tu atencion
            </p>
          </div>
          <span class="text-xs font-bold text-nova-accent">Ver</span>
        </NuxtLink>
      </div>

      <!-- ================================================ -->
      <!-- CTA: Dark gradient button                          -->
      <!-- ================================================ -->
      <NuxtLink
        to="/sales"
        class="dark-pill mt-4 flex w-full items-center justify-center gap-2.5 rounded-[20px] py-4 text-center text-[15px] font-extrabold tracking-wide transition-spring"
      >
        <DollarSign :size="20" />
        Nueva venta
      </NuxtLink>

      <!-- ================================================ -->
      <!-- PAYMENT MIX: Glass pill with mini bars             -->
      <!-- ================================================ -->
      <div
        v-if="topMethods.length > 0"
        class="glass mt-4 rounded-[20px] px-5 py-3"
      >
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-bold text-gray-500 tracking-wide">Metodos de pago</p>
          <div class="flex items-center gap-2">
            <span
              class="h-1.5 w-1.5 rounded-full"
              :class="{
                'bg-green-500': syncStatus === 'online',
                'bg-gray-400': syncStatus === 'offline',
                'bg-yellow-500 animate-pulse': syncStatus === 'syncing',
              }"
            />
            <span v-if="syncStatus === 'offline'" class="text-[10px] font-semibold text-gray-400">
              Offline
              <template v-if="pendingSyncCount > 0"> · {{ pendingSyncCount }}</template>
            </span>
            <button
              class="text-gray-300 transition-spring hover:text-gray-500 hover:scale-110"
              @click="loadDashboard"
            >
              <RefreshCw :size="13" />
            </button>
          </div>
        </div>
        <div class="mt-2.5 space-y-2">
          <div
            v-for="m in topMethods"
            :key="m.label"
            class="flex items-center gap-3"
          >
            <span class="w-14 text-[11px] font-bold text-gray-600">{{ m.label }}</span>
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-gray-100/80 border border-white">
              <div
                class="progress-glow h-full rounded-full bg-gradient-to-r"
                :class="m.color"
                :style="{ width: `${m.percent}%` }"
              />
            </div>
            <span class="w-8 text-right text-[11px] font-extrabold text-gray-700">{{ m.percent }}%</span>
          </div>
        </div>
      </div>
      <div
        v-else
        class="glass mt-4 flex items-center justify-between rounded-[20px] px-5 py-3"
      >
        <span class="text-[11px] font-semibold text-gray-400">Sin ventas hoy</span>
        <div class="flex items-center gap-2">
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="{
              'bg-green-500': syncStatus === 'online',
              'bg-gray-400': syncStatus === 'offline',
              'bg-yellow-500 animate-pulse': syncStatus === 'syncing',
            }"
          />
          <button
            class="text-gray-300 transition-spring hover:text-gray-500"
            @click="loadDashboard"
          >
            <RefreshCw :size="13" />
          </button>
        </div>
      </div>

      <!-- ================================================ -->
      <!-- Rate editor modal - glass panel                    -->
      <!-- ================================================ -->
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
                <label class="mb-1.5 block text-[13px] font-bold text-gray-600">
                  Dolar (USD)
                </label>
                <input
                  v-model="rateInputUsd"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="86.48"
                  class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none focus:ring-[3px] focus:ring-nova-accent/20 focus:bg-white transition-spring placeholder:text-gray-400"
                  autofocus
                >
              </div>
              <div>
                <label class="mb-1.5 block text-[13px] font-bold text-gray-600">
                  Euro (EUR)
                </label>
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
            <p v-if="rateSaveError" class="mt-3 text-sm font-semibold text-red-500">
              {{ rateSaveError }}
            </p>
            <p class="mt-3 text-[10px] font-semibold text-gray-400">
              Consulta la tasa oficial en bcv.org.ve
            </p>
            <div class="mt-5 flex gap-3">
              <button
                class="glass flex-1 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring hover:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.08)]"
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
