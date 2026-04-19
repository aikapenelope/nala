<script setup lang="ts">
/**
 * Dashboard - single screen, zero scroll on 6" phone.
 *
 * Answers 3 questions in 5 seconds:
 * 1. "How did I do today?" - sales total, profit, trend
 * 2. "What needs attention?" - debts, stock, cash flow, alerts
 * 3. "What's happening?" - top seller, star product, payment mix
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

/** Payment method labels. */
const methodLabels: Record<string, string> = {
  efectivo: "Efectivo",
  pago_movil: "Movil",
  binance: "Binance",
  zinli: "Zinli",
  transferencia: "Transf.",
  zelle: "Zelle",
  fiado: "Fiado",
};

/** Top 3 payment methods by amount. */
const topMethods = computed(() => {
  const entries = Object.entries(salesByMethod.value);
  if (entries.length === 0) return [];
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) return [];
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([method, amount]) => ({
      label: methodLabels[method] ?? method,
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

    // Daily
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

    // Receivables
    if (receivableResult.status === "fulfilled") {
      receivableTotal.value = receivableResult.value.totalPending;
    }

    // Inventory
    if (inventoryResult.status === "fulfilled") {
      const inv = inventoryResult.value.data;
      lowStockCount.value = (inv.lowStock ?? 0) + (inv.criticalStock ?? 0);
    }

    // Alerts
    if (alertsResult.status === "fulfilled") {
      alertCount.value = alertsResult.value.alerts.length;
    }

    // Exchange rate
    if (rateResult.status === "fulfilled") {
      exchangeRate.value = rateResult.value.rateBcv;
      euroRate.value = rateResult.value.rateEur;
    }

    // Cash flow
    if (cashFlowResult.status === "fulfilled") {
      cashFlow7d.value = cashFlowResult.value.data.projection7d.net;
    }

    // Cash opening
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

/** Online status. */
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

/** Save exchange rate. */
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
    <!-- Skeleton loading                                  -->
    <!-- ================================================ -->
    <div v-if="isLoading" class="animate-pulse space-y-3">
      <div class="h-6 w-48 rounded bg-gray-200"/>
      <div class="h-32 rounded-xl bg-gray-200"/>
      <div class="grid grid-cols-3 gap-3">
        <div class="h-20 rounded-xl bg-gray-200"/>
        <div class="h-20 rounded-xl bg-gray-200"/>
        <div class="h-20 rounded-xl bg-gray-200"/>
      </div>
      <div class="h-12 rounded-xl bg-gray-200"/>
    </div>

    <!-- Error state -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
      <button
        class="mt-2 block w-full text-xs font-medium text-red-700 underline"
        @click="loadDashboard"
      >
        Reintentar
      </button>
    </div>

    <template v-else>
      <!-- ================================================ -->
      <!-- HEADER: Greeting + Rate + Cash status             -->
      <!-- ================================================ -->
      <div class="mb-3 flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-gray-900">
            {{ greeting }}, {{ user?.businessName ?? "Nova" }}
          </h1>
          <p class="text-xs text-gray-400">
            {{ user?.name ?? "" }}
            <span v-if="isAdmin"> · Admin</span>
            <span
              v-if="isAdmin && cashOpened === false"
              class="ml-1 text-yellow-600"
            >
              · Caja sin abrir
            </span>
          </p>
        </div>
        <!-- BCV rate badge -->
        <button
          v-if="isAdmin"
          class="rounded-lg px-3 py-1.5 text-xs font-medium"
          :class="
            exchangeRate
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              : 'bg-yellow-100 text-yellow-700'
          "
          @click="openRateEditor"
        >
          <template v-if="exchangeRate">
            Bs.{{ exchangeRate.toFixed(2) }}
          </template>
          <template v-else> Configurar tasa </template>
        </button>
        <span
          v-else-if="exchangeRate"
          class="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500"
        >
          Bs.{{ exchangeRate.toFixed(2) }}
        </span>
      </div>

      <!-- ================================================ -->
      <!-- HERO: Today's sales + profit + trend              -->
      <!-- ================================================ -->
      <NuxtLink
        to="/sales/history"
        class="block rounded-xl bg-white p-5 shadow-sm transition-colors hover:bg-gray-50"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500">Vendido hoy</p>
            <p class="mt-1 text-3xl font-bold text-gray-900">
              ${{ todaySales.toFixed(2) }}
            </p>
          </div>
          <span
            v-if="trendPercent > 0"
            class="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
            :class="
              trendPositive
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            "
          >
            <component
              :is="trendPositive ? TrendingUp : TrendingDown"
              :size="12"
            />
            {{ trendPercent }}%
          </span>
        </div>
        <div class="mt-2 flex items-center gap-3 text-xs text-gray-400">
          <span>{{ todayCount }} venta{{ todayCount !== 1 ? "s" : "" }}</span>
          <span v-if="todayCount > 0">
            · ${{ todayAvgTicket.toFixed(2) }} prom
          </span>
          <span
            v-if="todayProfit !== 0"
            class="font-medium"
            :class="todayProfit >= 0 ? 'text-green-600' : 'text-red-500'"
          >
            · Ganancia ${{ todayProfit.toFixed(2) }}
          </span>
        </div>
      </NuxtLink>

      <!-- ================================================ -->
      <!-- 3 CARDS: Debts, Stock, Cash flow                  -->
      <!-- ================================================ -->
      <div class="mt-3 grid grid-cols-3 gap-3">
        <!-- Te deben -->
        <NuxtLink
          to="/accounts"
          class="rounded-xl bg-white p-3 shadow-sm transition-colors hover:bg-gray-50"
        >
          <Wallet
            :size="16"
            class="mb-1"
            :class="receivableTotal > 0 ? 'text-yellow-500' : 'text-green-500'"
          />
          <p class="text-lg font-bold text-gray-900">
            ${{ receivableTotal.toFixed(0) }}
          </p>
          <p class="text-[11px] text-gray-500">Te deben</p>
        </NuxtLink>

        <!-- Stock bajo -->
        <NuxtLink
          to="/inventory?status=red"
          class="rounded-xl bg-white p-3 shadow-sm transition-colors hover:bg-gray-50"
        >
          <Package
            :size="16"
            class="mb-1"
            :class="lowStockCount > 0 ? 'text-red-500' : 'text-green-500'"
          />
          <p class="text-lg font-bold text-gray-900">
            {{ lowStockCount }}
          </p>
          <p class="text-[11px] text-gray-500">
            {{ lowStockCount > 0 ? "Se acaban" : "Stock OK" }}
          </p>
        </NuxtLink>

        <!-- Cash flow 7d -->
        <NuxtLink
          to="/reports/cash-flow"
          class="rounded-xl bg-white p-3 shadow-sm transition-colors hover:bg-gray-50"
        >
          <CreditCard
            :size="16"
            class="mb-1"
            :class="cashFlow7d >= 0 ? 'text-green-500' : 'text-red-500'"
          />
          <p
            class="text-lg font-bold"
            :class="cashFlow7d >= 0 ? 'text-green-700' : 'text-red-600'"
          >
            {{ cashFlow7d >= 0 ? "+" : "" }}${{
              Math.abs(cashFlow7d).toFixed(0)
            }}
          </p>
          <p class="text-[11px] text-gray-500">En 7 dias</p>
        </NuxtLink>
      </div>

      <!-- ================================================ -->
      <!-- INSIGHTS: Top seller, star product, alerts        -->
      <!-- ================================================ -->
      <div class="mt-3 space-y-1.5">
        <!-- Top seller -->
        <div
          v-if="topSeller"
          class="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 shadow-sm"
        >
          <Trophy :size="14" class="flex-shrink-0 text-yellow-500" />
          <p class="flex-1 truncate text-sm text-gray-700">
            <span class="font-medium">{{ topSeller.name }}</span>
            vendio mas: ${{ topSeller.total.toFixed(0) }}
          </p>
        </div>

        <!-- Star product -->
        <div
          v-if="topProduct"
          class="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 shadow-sm"
        >
          <Star :size="14" class="flex-shrink-0 text-blue-500" />
          <p class="flex-1 truncate text-sm text-gray-700">
            <span class="font-medium">{{ topProduct.name }}</span>:
            {{ topProduct.quantity }} uds hoy
          </p>
        </div>

        <!-- Alerts summary -->
        <NuxtLink
          v-if="alertCount > 0"
          to="/reports"
          class="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 shadow-sm transition-colors hover:bg-gray-50"
        >
          <AlertTriangle :size="14" class="flex-shrink-0 text-orange-500" />
          <p class="flex-1 text-sm text-gray-700">
            {{ alertCount }} alerta{{ alertCount > 1 ? "s" : "" }} pendiente{{
              alertCount > 1 ? "s" : ""
            }}
          </p>
          <span class="text-xs text-nova-primary">Ver</span>
        </NuxtLink>
      </div>

      <!-- ================================================ -->
      <!-- CTA: Nueva venta                                  -->
      <!-- ================================================ -->
      <NuxtLink
        to="/sales"
        class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-nova-primary py-3.5 text-center font-semibold text-white shadow-lg shadow-nova-primary/25"
      >
        <DollarSign :size="18" />
        Nueva venta
      </NuxtLink>

      <!-- ================================================ -->
      <!-- FOOTER: Payment mix + connection + refresh         -->
      <!-- ================================================ -->
      <div class="mt-3 flex items-center justify-between">
        <!-- Payment method mix -->
        <div v-if="topMethods.length > 0" class="flex gap-2 text-[10px]">
          <span
            v-for="m in topMethods"
            :key="m.label"
            class="text-gray-400"
          >
            {{ m.label }} {{ m.percent }}%
          </span>
        </div>
        <div v-else class="text-[10px] text-gray-300">Sin ventas hoy</div>

        <!-- Connection + refresh -->
        <div class="flex items-center gap-2">
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="{
              'bg-green-500': syncStatus === 'online',
              'bg-gray-400': syncStatus === 'offline',
              'bg-yellow-500 animate-pulse': syncStatus === 'syncing',
            }"
          />
          <span v-if="syncStatus === 'offline'" class="text-[10px] text-gray-400">
            Offline
            <template v-if="pendingSyncCount > 0">
              · {{ pendingSyncCount }}
            </template>
          </span>
          <button
            class="text-gray-300 hover:text-gray-500"
            @click="loadDashboard"
          >
            <RefreshCw :size="12" />
          </button>
        </div>
      </div>

      <!-- ================================================ -->
      <!-- Rate editor modal                                 -->
      <!-- ================================================ -->
      <Teleport to="body">
        <div
          v-if="showRateEditor"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          @click.self="showRateEditor = false"
        >
          <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 class="mb-4 text-lg font-semibold text-gray-900">
              Tasa de cambio BCV
            </h3>
            <div class="space-y-3">
              <div>
                <label class="mb-1 block text-sm text-gray-600">
                  Dolar (USD)
                </label>
                <input
                  v-model="rateInputUsd"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="86.48"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
                  autofocus
                >
              </div>
              <div>
                <label class="mb-1 block text-sm text-gray-600">
                  Euro (EUR)
                </label>
                <input
                  v-model="rateInputEur"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="96.20"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
                >
              </div>
            </div>
            <p v-if="rateSaveError" class="mt-2 text-sm text-red-500">
              {{ rateSaveError }}
            </p>
            <p class="mt-2 text-[10px] text-gray-400">
              Consulta la tasa oficial en bcv.org.ve
            </p>
            <div class="mt-4 flex gap-3">
              <button
                class="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
                @click="showRateEditor = false"
              >
                Cancelar
              </button>
              <button
                class="flex-1 rounded-lg bg-nova-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
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
