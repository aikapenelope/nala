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
 *   - Actionable alerts with suggestions
 *   - Weekly chart with AI narrative
 *   - Last action performed
 *
 * Based on Square/Shopify/F1Studioz research (doc 17).
 */

const { isMobile, isDesktop } = useDevice();
const { isAdmin } = useNovaAuth();

/** Mock dashboard data. Will come from API in production. */
const todaySales = ref(420.0);
const todayCount = ref(23);
const todayAvgTicket = ref(18.26);
const trendPercent = ref(12);
const trendPositive = ref(true);

const receivableTotal = ref(95.0);
const lowStockCount = ref(3);
const alertCount = ref(2);

/** Actionable alerts. */
const alerts = ref([
  {
    id: "a1",
    icon: "📦",
    title: "Harina PAN: stock para ~2 días",
    suggestion: "Pedir 10 sacos al proveedor",
    actionLabel: "Generar orden",
    actionTo: "/inventory",
    severity: "warning" as const,
  },
  {
    id: "a2",
    icon: "💰",
    title: "Juan Pérez debe $65 hace 35 días",
    suggestion: "Historial: siempre paga cuando le recuerdas",
    actionLabel: "Cobrar por WhatsApp",
    actionTo: "/accounts",
    severity: "info" as const,
  },
]);

/** Weekly sales data for chart. */
const weeklyData = ref([
  { day: "Lu", amount: 420 },
  { day: "Ma", amount: 350 },
  { day: "Mi", amount: 520 },
  { day: "Ju", amount: 300 },
  { day: "Vi", amount: 620 },
  { day: "Sa", amount: 780 },
  { day: "Do", amount: 280 },
]);

const weeklyMax = computed(() =>
  Math.max(...weeklyData.value.map((d) => d.amount)),
);

/** AI narrative for the week. */
const weeklyNarrative = ref(
  "Esta semana vendiste $3,270, 8% más que la anterior. " +
    "Tu mejor día fue sábado. Tu producto estrella: Pan Campesino.",
);

/** Last action. */
const lastAction = ref({
  text: "Pan Campesino x3, $4.50",
  time: "hace 5 min",
});

/** Sync status. */
const syncStatus = ref<"online" | "offline" | "syncing">("online");
const pendingSyncCount = ref(0);
</script>

<template>
  <div>
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
        class="mt-1 text-sm font-medium"
        :class="trendPositive ? 'text-green-600' : 'text-red-600'"
      >
        {{ trendPositive ? "▲" : "▼" }} {{ trendPercent }}% vs martes pasado
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

      <div
        v-if="isDesktop"
        class="rounded-xl bg-white p-4 shadow-sm"
      >
        <p class="text-lg font-semibold text-gray-900">
          {{ alertCount }}
        </p>
        <p class="text-xs text-gray-500">alertas pendientes</p>
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
        Sin conexión
        <template v-if="pendingSyncCount > 0">
          · {{ pendingSyncCount }} pendiente{{ pendingSyncCount > 1 ? "s" : "" }}
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

    <!-- Actionable alerts -->
    <div v-if="alerts.length > 0" class="mt-6">
      <h2 class="mb-3 text-sm font-semibold text-gray-700">
        Alertas que necesitan tu atención
      </h2>
      <div class="space-y-2">
        <div
          v-for="alert in isMobile ? alerts.slice(0, 1) : alerts"
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
    </div>

    <!-- Weekly chart (Level 2) -->
    <div v-if="isAdmin" class="mt-6 rounded-xl bg-white p-5 shadow-sm">
      <h2 class="mb-4 text-sm font-semibold text-gray-700">
        Cómo te fue esta semana
      </h2>

      <!-- Simple bar chart using CSS -->
      <div class="flex items-end gap-2" style="height: 120px">
        <div
          v-for="d in weeklyData"
          :key="d.day"
          class="flex flex-1 flex-col items-center gap-1"
        >
          <span class="text-[10px] text-gray-500">
            ${{ d.amount }}
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
      <p class="mt-4 text-sm text-gray-600 italic">
        "{{ weeklyNarrative }}"
      </p>

      <NuxtLink
        to="/reports"
        class="mt-3 inline-block text-xs font-medium text-nova-primary hover:underline"
      >
        Ver reporte completo →
      </NuxtLink>
    </div>

    <!-- Last action -->
    <div v-if="lastAction" class="mt-4 text-xs text-gray-400">
      Última venta: {{ lastAction.text }}, {{ lastAction.time }}
    </div>
  </div>
</template>
