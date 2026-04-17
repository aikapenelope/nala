<script setup lang="ts">
/**
 * Dashboard with visual-first design for Venezuelan small business owners.
 *
 * Design principles:
 * - Everything important visible without scroll on a 6" phone
 * - Big numbers, clear colors (green = good, red = attention)
 * - Icons + text always (never icon-only)
 * - Colloquial Spanish ("te deben", "se te acaba")
 * - One-tap actions
 *
 * Level 1 (no scroll): "How did I do today?"
 *   - Greeting with business name + time of day
 *   - Today's sales (big number) with trend
 *   - 3 visual cards: receivable, low stock, cash flow 7d
 *   - BCV rate
 *   - Quick action: "Nueva venta"
 *
 * Level 2 (scroll): Detail on demand
 *   - Actionable alerts (3 on mobile, 4 on desktop)
 *   - Weekly chart with AI narrative
 *   - Last sale info
 *
 * Connected to:
 *   - GET /api/reports/daily
 *   - GET /api/reports/weekly
 *   - GET /api/reports/inventory
 *   - GET /api/reports/cash-flow
 *   - GET /api/accounts/receivable
 *   - GET /api/reports/alerts
 *   - GET /api/exchange-rate
 *   - GET /api/sales?limit=1
 */

const { isMobile } = useDevice();
const { isAdmin, user } = useNovaAuth();
const { $api } = useApi();

/** Loading and error state. */
const isLoading = ref(true);
const loadError = ref("");

/** Daily report data. */
const todaySales = ref(0);
const todayCount = ref(0);
const todayAvgTicket = ref(0);
const trendPercent = ref(0);
const trendPositive = ref(true);

/** Summary cards. */
const receivableTotal = ref(0);
const lowStockCount = ref(0);

/** Cash flow projection. */
const cashFlow7d = ref(0);

/** Exchange rate. */
const exchangeRate = ref<number | null>(null);
const euroRate = ref<number | null>(null);
const showRateEditor = ref(false);
const rateInputUsd = ref("");
const rateInputEur = ref("");
const rateSaving = ref(false);
const rateSaveError = ref("");

/** Smart alerts from API. */
interface Alert {
  id: string;
  icon: string;
  title: string;
  suggestion: string;
  actionLabel: string;
  actionTo: string;
  severity: "critical" | "warning" | "info";
}
const alerts = ref<Alert[]>([]);

/** Weekly data. */
const weeklyData = ref<Array<{ day: string; amount: number }>>([]);
const weeklyNarrative = ref("");

const weeklyMax = computed(() => {
  if (weeklyData.value.length === 0) return 1;
  return Math.max(...weeklyData.value.map((d) => d.amount), 1);
});

/** Last sale. */
const lastSale = ref<{
  totalUsd: string;
  createdAt: string;
} | null>(null);

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

/** Load all dashboard data from API in parallel. */
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
      receivableResult,
      inventoryResult,
      alertsResult,
      rateResult,
      lastSaleResult,
      cashFlowResult,
    ] = await Promise.allSettled([
      $api<{
        data: {
          totalSales: number;
          totalCount: number;
          avgTicket: number;
          vsPreviousDay: number;
          vsSameDayLastWeek: number;
        };
      }>("/api/reports/daily"),

      $api<{
        data: { dailyBreakdown: Array<{ day: string; amount: number }> };
        narrative: string;
      }>("/api/reports/weekly?period=week"),

      $api<{ totalPending: number }>("/api/accounts/receivable"),

      $api<{ data: { lowStock: number; criticalStock: number } }>(
        "/api/reports/inventory",
      ),

      $api<{ alerts: Alert[] }>("/api/reports/alerts"),

      $api<{ rateBcv: number; rateEur: number | null }>("/api/exchange-rate"),

      $api<{ sales: Array<{ totalUsd: string; createdAt: string }> }>(
        "/api/sales?limit=1",
      ),

      $api<{
        data: { projection7d: { net: number } };
      }>("/api/reports/cash-flow"),
    ]);

    // Daily
    if (dailyResult.status === "fulfilled") {
      const d = dailyResult.value.data;
      todaySales.value = d.totalSales;
      todayCount.value = d.totalCount;
      todayAvgTicket.value = d.avgTicket;
      trendPercent.value = Math.abs(d.vsSameDayLastWeek);
      trendPositive.value = d.vsSameDayLastWeek >= 0;
    }

    // Weekly
    if (weeklyResult.status === "fulfilled") {
      weeklyData.value = weeklyResult.value.data.dailyBreakdown;
      weeklyNarrative.value = weeklyResult.value.narrative;
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
      alerts.value = alertsResult.value.alerts;
    }

    // Exchange rate
    if (rateResult.status === "fulfilled") {
      exchangeRate.value = rateResult.value.rateBcv;
      euroRate.value = rateResult.value.rateEur;
    }

    // Last sale
    if (lastSaleResult.status === "fulfilled") {
      const salesArr = lastSaleResult.value.sales;
      lastSale.value = salesArr[0] ?? null;
    }

    // Cash flow
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

/** Day name for trend comparison. */
const dayNames = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];
const todayDayName = computed(() => {
  const lastWeekDay = new Date();
  lastWeekDay.setDate(lastWeekDay.getDate() - 7);
  return dayNames[lastWeekDay.getDay()] ?? "semana pasada";
});

/** Format relative time for last sale. */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

/** Save exchange rate from the editor. */
async function saveRate() {
  const usd = Number(rateInputUsd.value);
  const eur = rateInputEur.value ? Number(rateInputEur.value) : undefined;

  if (!usd || usd <= 0) {
    rateSaveError.value = "La tasa del dolar debe ser mayor a 0";
    return;
  }
  if (eur !== undefined && eur <= 0) {
    rateSaveError.value = "La tasa del euro debe ser mayor a 0";
    return;
  }

  rateSaving.value = true;
  rateSaveError.value = "";

  try {
    const result = await $api<{ rateBcv: number; rateEur: number | null }>(
      "/api/exchange-rate",
      {
        method: "POST",
        body: { rateBcv: usd, rateEur: eur },
      },
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

/** Alerts to show: 3 on mobile, 4 on desktop. */
const visibleAlerts = computed(() => {
  if (isMobile.value) return alerts.value.slice(0, 3);
  return alerts.value.slice(0, 4);
});

/** Alert border color by severity. */
function alertBorder(severity: string): string {
  if (severity === "critical") return "border-l-red-500";
  if (severity === "warning") return "border-l-yellow-500";
  return "border-l-blue-400";
}
</script>

<template>
  <div>
    <!-- ============================================ -->
    <!-- Skeleton loading                             -->
    <!-- ============================================ -->
    <div v-if="isLoading" class="animate-pulse space-y-4">
      <div class="h-6 w-48 rounded bg-gray-200" />
      <div class="h-28 rounded-xl bg-gray-200" />
      <div class="grid grid-cols-3 gap-3">
        <div class="h-20 rounded-xl bg-gray-200" />
        <div class="h-20 rounded-xl bg-gray-200" />
        <div class="h-20 rounded-xl bg-gray-200" />
      </div>
      <div class="h-10 rounded-xl bg-gray-200" />
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
      <!-- ============================================ -->
      <!-- GREETING + RATE                              -->
      <!-- ============================================ -->
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-gray-900">
            {{ greeting }}, {{ user?.businessName ?? "Nova" }}
          </h1>
          <p class="text-xs text-gray-400">
            {{ user?.name ?? "" }}
            <span v-if="isAdmin"> · Administrador</span>
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

      <!-- Rate editor modal -->
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
                <label class="mb-1 block text-sm text-gray-600"
                  >Dolar (USD)</label
                >
                <input
                  v-model="rateInputUsd"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="477.14"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
                  autofocus
                />
              </div>
              <div>
                <label class="mb-1 block text-sm text-gray-600"
                  >Euro (EUR)</label
                >
                <input
                  v-model="rateInputEur"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="560.04"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
                />
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

      <!-- ============================================ -->
      <!-- LEVEL 1: The answer (no scroll needed)       -->
      <!-- ============================================ -->

      <!-- Main metric: today's sales -->
      <NuxtLink
        to="/sales/history"
        class="block rounded-xl bg-white p-5 shadow-sm transition-colors hover:bg-gray-50"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-gray-500">Vendido hoy</p>
          <span
            v-if="trendPercent > 0"
            class="rounded-full px-2 py-0.5 text-xs font-semibold"
            :class="
              trendPositive
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            "
          >
            {{ trendPositive ? "+" : "-" }}{{ trendPercent }}%
          </span>
        </div>
        <p class="mt-1 text-3xl font-bold text-gray-900">
          ${{ todaySales.toFixed(2) }}
        </p>
        <p class="mt-1 text-xs text-gray-400">
          {{ todayCount }} venta{{ todayCount !== 1 ? "s" : "" }}
          <template v-if="todayCount > 0">
            · ${{ todayAvgTicket.toFixed(2) }} promedio
          </template>
          <template v-if="trendPercent > 0">
            · vs {{ todayDayName }} pasado
          </template>
        </p>
      </NuxtLink>

      <!-- Summary cards: 3 always visible -->
      <div class="mt-3 grid grid-cols-3 gap-3">
        <!-- Te deben -->
        <NuxtLink
          to="/accounts"
          class="rounded-xl bg-white p-3 shadow-sm transition-colors hover:bg-gray-50"
        >
          <div
            class="mb-1 flex h-8 w-8 items-center justify-center rounded-lg"
            :class="
              receivableTotal > 0 ? 'bg-yellow-100' : 'bg-green-100'
            "
          >
            <span class="text-sm">{{
              receivableTotal > 0 ? "💰" : "✓"
            }}</span>
          </div>
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
          <div
            class="mb-1 flex h-8 w-8 items-center justify-center rounded-lg"
            :class="lowStockCount > 0 ? 'bg-red-100' : 'bg-green-100'"
          >
            <span class="text-sm">{{
              lowStockCount > 0 ? "📦" : "✓"
            }}</span>
          </div>
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
          <div
            class="mb-1 flex h-8 w-8 items-center justify-center rounded-lg"
            :class="cashFlow7d >= 0 ? 'bg-green-100' : 'bg-red-100'"
          >
            <span class="text-sm">{{ cashFlow7d >= 0 ? "📈" : "📉" }}</span>
          </div>
          <p
            class="text-lg font-bold"
            :class="cashFlow7d >= 0 ? 'text-green-700' : 'text-red-600'"
          >
            {{ cashFlow7d >= 0 ? "+" : "" }}${{ Math.abs(cashFlow7d).toFixed(0) }}
          </p>
          <p class="text-[11px] text-gray-500">En 7 dias</p>
        </NuxtLink>
      </div>

      <!-- Sync status + refresh -->
      <div class="mt-3 flex items-center justify-between">
        <div class="flex items-center gap-2 text-xs text-gray-400">
          <span
            class="h-2 w-2 rounded-full"
            :class="{
              'bg-green-500': syncStatus === 'online',
              'bg-gray-400': syncStatus === 'offline',
              'bg-yellow-500 animate-pulse': syncStatus === 'syncing',
            }"
          />
          <span v-if="syncStatus === 'online'">Actualizado</span>
          <span v-else-if="syncStatus === 'syncing'">Sincronizando...</span>
          <span v-else>
            Sin conexion
            <template v-if="pendingSyncCount > 0">
              · {{ pendingSyncCount }} pendiente{{
                pendingSyncCount > 1 ? "s" : ""
              }}
            </template>
          </span>
        </div>
        <button
          class="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          @click="loadDashboard"
        >
          Actualizar
        </button>
      </div>

      <!-- Quick action: Nueva venta -->
      <NuxtLink
        to="/sales"
        class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-nova-primary py-3.5 text-center font-semibold text-white shadow-lg shadow-nova-primary/25"
      >
        + Nueva venta
      </NuxtLink>

      <!-- ============================================ -->
      <!-- LEVEL 2: Detail (scroll down)                -->
      <!-- ============================================ -->

      <!-- Actionable alerts -->
      <div v-if="visibleAlerts.length > 0" class="mt-6">
        <h2 class="mb-3 text-sm font-semibold text-gray-700">
          Necesita tu atencion
        </h2>
        <div class="space-y-2">
          <NuxtLink
            v-for="alert in visibleAlerts"
            :key="alert.id"
            :to="alert.actionTo"
            class="block rounded-xl border-l-4 bg-white p-4 shadow-sm"
            :class="alertBorder(alert.severity)"
          >
            <div class="flex items-start gap-3">
              <span class="text-lg">{{ alert.icon }}</span>
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-900">
                  {{ alert.title }}
                </p>
                <p class="mt-0.5 text-xs text-gray-500">
                  {{ alert.suggestion }}
                </p>
              </div>
              <span
                class="flex-shrink-0 text-xs font-medium text-nova-primary"
              >
                {{ alert.actionLabel }} →
              </span>
            </div>
          </NuxtLink>
        </div>
        <NuxtLink
          v-if="alerts.length > visibleAlerts.length"
          to="/reports"
          class="mt-2 block text-center text-xs text-gray-400 hover:text-nova-primary"
        >
          Ver {{ alerts.length - visibleAlerts.length }} alerta{{
            alerts.length - visibleAlerts.length > 1 ? "s" : ""
          }}
          mas
        </NuxtLink>
      </div>

      <!-- Weekly chart (admin only) -->
      <div
        v-if="isAdmin && weeklyData.length > 0"
        class="mt-6 rounded-xl bg-white p-5 shadow-sm"
      >
        <h2 class="mb-4 text-sm font-semibold text-gray-700">
          Esta semana
        </h2>

        <!-- Bar chart -->
        <div class="flex items-end gap-2" style="height: 120px">
          <div
            v-for="d in weeklyData"
            :key="d.day"
            class="flex flex-1 flex-col items-center gap-1"
          >
            <span class="text-[10px] text-gray-500">
              ${{ d.amount.toFixed(0) }}
            </span>
            <div
              class="w-full rounded-t bg-nova-primary/80"
              :style="{
                height: `${(d.amount / weeklyMax) * 100}%`,
                minHeight: '4px',
              }"
            />
            <span class="text-[10px] text-gray-400">{{ d.day }}</span>
          </div>
        </div>

        <!-- AI narrative -->
        <p v-if="weeklyNarrative" class="mt-4 text-sm italic text-gray-600">
          "{{ weeklyNarrative }}"
        </p>

        <NuxtLink
          to="/reports"
          class="mt-3 inline-block text-xs font-medium text-nova-primary hover:underline"
        >
          Ver reportes completos →
        </NuxtLink>
      </div>

      <!-- Last sale -->
      <div v-if="lastSale" class="mt-4 text-xs text-gray-400">
        Ultima venta: ${{ Number(lastSale.totalUsd).toFixed(2) }},
        {{ timeAgo(lastSale.createdAt) }}
      </div>
    </template>
  </div>
</template>
