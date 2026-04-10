<script setup lang="ts">
/**
 * Dashboard with progressive disclosure.
 *
 * Level 1 (visible without scroll): Answer to "How did I do today?"
 *   - Big number: today's sales
 *   - Trend vs same day last week
 *   - 2-3 summary cards (receivable, low stock, alerts)
 *
 * Level 2 (scroll down): Detail on demand
 *   - Weekly chart with AI narrative
 *   - Last sale info
 *
 * Connected to:
 *   - GET /api/reports/daily (today's summary)
 *   - GET /api/reports/weekly (weekly chart + narrative)
 *   - GET /api/reports/inventory (low stock count)
 *   - GET /api/accounts/receivable (total pending)
 */

const { isMobile, isDesktop } = useDevice();
const { isAdmin, isAuthenticated } = useNovaAuth();
const { $api } = useApi();

/** Loading and error state. */
const isLoading = ref(true);
const loadError = ref("");

/** Daily report data from API. */
const todaySales = ref(0);
const todayCount = ref(0);
const todayAvgTicket = ref(0);
const trendPercent = ref(0);
const trendPositive = ref(true);

/** Summary cards. */
const receivableTotal = ref(0);
const lowStockCount = ref(0);

/** Weekly data from API. */
const weeklyData = ref<Array<{ day: string; amount: number }>>([]);
const weeklyNarrative = ref("");

const weeklyMax = computed(() => {
  if (weeklyData.value.length === 0) return 1;
  return Math.max(...weeklyData.value.map((d) => d.amount), 1);
});

/** Sync status from offline queue. */
const syncStatus = ref<"online" | "offline" | "syncing">("online");
const pendingSyncCount = ref(0);

/** Load all dashboard data from API. */
async function loadDashboard() {
  isLoading.value = true;
  loadError.value = "";

  try {
    // Fetch daily report, weekly report, receivables, and inventory in parallel
    const [dailyResult, weeklyResult, receivableResult, inventoryResult] =
      await Promise.allSettled([
        $api<{
          data: {
            totalSales: number;
            totalCount: number;
            avgTicket: number;
            vsPreviousDay: number;
            vsSameDayLastWeek: number;
          };
          narrative: string;
        }>("/api/reports/daily"),

        $api<{
          data: {
            dailyBreakdown: Array<{ day: string; amount: number }>;
          };
          narrative: string;
        }>("/api/reports/weekly?period=week"),

        $api<{ totalPending: number }>("/api/accounts/receivable"),

        $api<{ lowStock: number; criticalStock: number }>(
          "/api/reports/inventory",
        ),
      ]);

    // Daily report
    if (dailyResult.status === "fulfilled") {
      const d = dailyResult.value.data;
      todaySales.value = d.totalSales;
      todayCount.value = d.totalCount;
      todayAvgTicket.value = d.avgTicket;
      trendPercent.value = Math.abs(d.vsSameDayLastWeek);
      trendPositive.value = d.vsSameDayLastWeek >= 0;
    }

    // Weekly report
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
      const inv = inventoryResult.value;
      // inv comes wrapped in { data: { ... } } from the reports endpoint
      const invData =
        (
          inv as unknown as {
            data: { lowStock: number; criticalStock: number };
          }
        ).data ?? inv;
      lowStockCount.value =
        (invData.lowStock ?? 0) + (invData.criticalStock ?? 0);
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando dashboard";
    loadError.value = message;
  } finally {
    isLoading.value = false;
  }
}

/** Update online status. */
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

  if (isAuthenticated.value) {
    loadDashboard();
  }
});

/** Day name in Spanish for the trend comparison. */
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

    <!-- Not authenticated -->
    <div v-else-if="!isAuthenticated" class="py-12 text-center text-gray-500">
      <p>Inicia sesion para ver tu dashboard</p>
      <NuxtLink
        to="/auth/pin"
        class="mt-4 inline-block rounded-xl bg-nova-primary px-6 py-2 text-sm font-medium text-white"
      >
        Ingresar PIN
      </NuxtLink>
    </div>

    <template v-else>
      <!-- ============================================ -->
      <!-- LEVEL 1: The answer (no scroll needed)       -->
      <!-- ============================================ -->

      <!-- Main metric: today's sales -->
      <div
        class="cursor-pointer rounded-xl bg-white p-6 text-center shadow-sm transition-colors hover:bg-gray-50"
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
      </div>

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

        <div v-if="isDesktop" class="rounded-xl bg-white p-4 shadow-sm">
          <p class="text-lg font-semibold text-gray-900">
            {{ todayCount }}
          </p>
          <p class="text-xs text-gray-500">ventas hoy</p>
        </div>
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

      <!-- Weekly chart (Level 2) -->
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
            <span class="text-[10px] text-gray-500"> ${{ d.amount }} </span>
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
    </template>
  </div>
</template>
