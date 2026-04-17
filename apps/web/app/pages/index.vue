<script setup lang="ts">
/**
 * Dashboard with progressive disclosure (doc 17 spec).
 *
 * Level 1 (visible without scroll): Answer to "How did I do today?"
 *   - Big number: today's sales (tap -> sales detail)
 *   - Trend vs same day last week
 *   - 2-3 summary cards: receivable, low stock, alerts count
 *   - BCV exchange rate in header area
 *
 * Level 2 (scroll down): Detail on demand
 *   - Actionable alerts with suggestion + action button
 *   - Weekly chart with AI narrative
 *   - Last sale info
 *
 * Connected to:
 *   - GET /api/reports/daily (today's summary)
 *   - GET /api/reports/weekly (weekly chart + narrative)
 *   - GET /api/reports/inventory (low stock count)
 *   - GET /api/accounts/receivable (total pending)
 *   - GET /api/reports/alerts (smart actionable alerts)
 *   - GET /api/exchange-rate (BCV rate)
 *   - GET /api/sales?limit=1 (last sale)
 */

const { isMobile, isDesktop } = useDevice();
const { isAdmin } = useNovaAuth();
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

  // Global auth middleware handles unauthenticated redirect.
  // If we reach here, the user is authenticated.
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

/** Alerts to show: all on desktop, max 2 on mobile. */
const visibleAlerts = computed(() => {
  if (isMobile.value) return alerts.value.slice(0, 1);
  return alerts.value.slice(0, 4);
});
</script>

<template>
  <div>
    <!-- Loading state -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
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
      <!-- BCV Rate (header area, tappable by owner)    -->
      <!-- ============================================ -->
      <div
        class="mb-3 flex items-center justify-end gap-3 text-xs text-gray-400"
      >
        <template v-if="exchangeRate">
          <span>USD {{ exchangeRate.toFixed(2) }}</span>
          <span v-if="euroRate">· EUR {{ euroRate.toFixed(2) }}</span>
        </template>
        <span v-else class="text-yellow-600">Tasa no configurada</span>
        <button
          v-if="isAdmin"
          class="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 hover:bg-gray-200"
          @click="openRateEditor"
        >
          {{ exchangeRate ? "Cambiar" : "Configurar" }}
        </button>
      </div>

      <!-- Rate editor modal -->
      <div
        v-if="showRateEditor"
        class="mb-4 rounded-xl border border-nova-primary/20 bg-blue-50 p-4"
      >
        <h3 class="mb-3 text-sm font-semibold text-gray-700">
          Tasa de cambio BCV
        </h3>
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="mb-1 block text-xs text-gray-500">Dolar (USD)</label>
            <input
              v-model="rateInputUsd"
              type="number"
              step="0.01"
              min="0"
              placeholder="477.14"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            />
          </div>
          <div class="flex-1">
            <label class="mb-1 block text-xs text-gray-500">Euro (EUR)</label>
            <input
              v-model="rateInputEur"
              type="number"
              step="0.01"
              min="0"
              placeholder="560.04"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            />
          </div>
        </div>
        <p v-if="rateSaveError" class="mt-2 text-xs text-red-500">
          {{ rateSaveError }}
        </p>
        <div class="mt-3 flex gap-2">
          <button
            class="flex-1 rounded-lg border border-gray-300 py-2 text-xs font-medium text-gray-600"
            @click="showRateEditor = false"
          >
            Cancelar
          </button>
          <button
            class="flex-1 rounded-lg bg-nova-primary py-2 text-xs font-medium text-white disabled:opacity-50"
            :disabled="rateSaving"
            @click="saveRate"
          >
            {{ rateSaving ? "Guardando..." : "Guardar tasa" }}
          </button>
        </div>
        <p class="mt-2 text-[10px] text-gray-400">
          Consulta la tasa oficial en bcv.org.ve
        </p>
      </div>

      <!-- ============================================ -->
      <!-- LEVEL 1: The answer (no scroll needed)       -->
      <!-- ============================================ -->

      <!-- Main metric: today's sales -->
      <NuxtLink
        to="/sales/history"
        class="block cursor-pointer rounded-xl bg-white p-6 text-center shadow-sm transition-colors hover:bg-gray-50"
      >
        <p class="text-4xl font-bold text-gray-900">
          ${{ todaySales.toFixed(2) }}
        </p>
        <p class="mt-1 text-sm text-gray-500">vendidos hoy</p>
        <p
          v-if="trendPercent > 0"
          class="mt-1 text-sm font-medium"
          :class="trendPositive ? 'text-green-600' : 'text-red-600'"
        >
          {{ trendPositive ? "▲" : "▼" }} {{ trendPercent }}% vs
          {{ todayDayName }} pasado
        </p>
        <p v-if="isDesktop" class="mt-0.5 text-xs text-gray-400">
          {{ todayCount }} ventas · ${{ todayAvgTicket.toFixed(2) }} ticket
          promedio
        </p>
      </NuxtLink>

      <!-- Summary cards -->
      <div
        class="mt-4 grid gap-3"
        :class="isMobile ? 'grid-cols-2' : 'grid-cols-3'"
      >
        <NuxtLink
          to="/accounts"
          class="rounded-xl bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
        >
          <p class="text-lg font-semibold text-gray-900">
            ${{ receivableTotal.toFixed(0) }}
          </p>
          <p class="text-xs text-gray-500">por cobrar</p>
        </NuxtLink>

        <NuxtLink
          to="/inventory?status=red"
          class="rounded-xl bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
        >
          <p class="text-lg font-semibold text-gray-900">
            {{ lowStockCount }}
          </p>
          <p class="text-xs text-gray-500">stock bajo</p>
        </NuxtLink>

        <NuxtLink
          v-if="isDesktop"
          to="/reports"
          class="rounded-xl bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
        >
          <p class="text-lg font-semibold text-gray-900">
            {{ alerts.length }}
          </p>
          <p class="text-xs text-gray-500">alertas pendientes</p>
        </NuxtLink>
      </div>

      <!-- Sync status indicator -->
      <div class="mt-3 flex items-center gap-2 text-xs text-gray-400">
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

      <!-- Mobile: quick action -->
      <div v-if="isMobile" class="mt-4">
        <NuxtLink
          to="/sales"
          class="block w-full rounded-xl bg-nova-primary py-3 text-center font-semibold text-white"
        >
          + Nueva venta
        </NuxtLink>
      </div>

      <!-- ============================================ -->
      <!-- LEVEL 2: Detail (scroll down)                -->
      <!-- ============================================ -->

      <!-- Actionable alerts (doc 17: suggestion + action button) -->
      <div v-if="visibleAlerts.length > 0" class="mt-6">
        <h2 class="mb-3 text-sm font-semibold text-gray-700">
          Alertas que necesitan tu atencion
        </h2>
        <div class="space-y-2">
          <div
            v-for="alert in visibleAlerts"
            :key="alert.id"
            class="rounded-xl bg-white p-4 shadow-sm"
          >
            <div class="flex items-start gap-3">
              <span class="text-xl">{{ alert.icon }}</span>
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-900">
                  {{ alert.title }}
                </p>
                <p class="mt-0.5 text-xs text-gray-500">
                  {{ alert.suggestion }}
                </p>
              </div>
              <NuxtLink
                :to="alert.actionTo"
                class="flex-shrink-0 rounded-lg bg-nova-primary/10 px-3 py-1.5 text-xs font-medium text-nova-primary"
              >
                {{ alert.actionLabel }}
              </NuxtLink>
            </div>
          </div>
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

      <!-- Weekly chart (Level 2, admin only) -->
      <div
        v-if="isAdmin && weeklyData.length > 0"
        class="mt-6 rounded-xl bg-white p-5 shadow-sm"
      >
        <h2 class="mb-4 text-sm font-semibold text-gray-700">
          Como te fue esta semana
        </h2>

        <!-- Simple bar chart using CSS -->
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
          Ver reporte completo →
        </NuxtLink>
      </div>

      <!-- Last sale (doc 17: "access to last action") -->
      <div v-if="lastSale" class="mt-4 text-xs text-gray-400">
        Ultima venta: ${{ Number(lastSale.totalUsd).toFixed(2) }},
        {{ timeAgo(lastSale.createdAt) }}
      </div>
    </template>
  </div>
</template>
