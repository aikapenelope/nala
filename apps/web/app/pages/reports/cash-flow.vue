<script setup lang="ts">
/**
 * Cash flow projection report.
 *
 * Shows:
 * - Average daily revenue and expenses (last 30 days)
 * - Pending receivable and payable
 * - 7-day and 30-day projections
 * - 14-day trend chart
 * - AI narrative
 *
 * Connected to: GET /api/reports/cash-flow
 */

definePageMeta({ middleware: ["admin-only"] });

const { $api } = useApi();
const isLoading = ref(true);
const loadError = ref("");
const narrative = ref("");

const data = ref({
  avgDailyRevenue: 0,
  avgDailyExpenses: 0,
  pendingReceivable: 0,
  pendingPayable: 0,
  projection7d: { revenue: 0, expenses: 0, net: 0 },
  projection30d: { revenue: 0, expenses: 0, net: 0 },
  trend: {
    dailyRevenue: [] as Array<{ date: string; revenue: number }>,
    dailyExpenses: [] as Array<{ date: string; amount: number }>,
  },
});

async function loadReport() {
  isLoading.value = true;
  loadError.value = "";
  try {
    const result = await $api<{
      data: typeof data.value;
      narrative: string;
    }>("/api/reports/cash-flow");
    data.value = result.data;
    narrative.value = result.narrative;
  } catch {
    loadError.value = "Error cargando proyeccion de flujo de caja";
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadReport);
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-6">
      <NuxtLink
        to="/reports"
        class="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        ← Reportes
      </NuxtLink>
      <h1 class="text-xl font-bold text-gray-900">Flujo de caja</h1>
      <p class="text-sm text-gray-500">
        Proyeccion basada en los ultimos 30 dias
      </p>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="animate-pulse space-y-4">
      <div class="h-24 rounded-xl bg-gray-200" />
      <div class="grid grid-cols-2 gap-3">
        <div class="h-20 rounded-xl bg-gray-200" />
        <div class="h-20 rounded-xl bg-gray-200" />
      </div>
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
      <button
        class="mt-2 block w-full text-xs font-medium text-red-700 underline"
        @click="loadReport"
      >
        Reintentar
      </button>
    </div>

    <template v-else>
      <!-- Projection cards -->
      <div class="grid grid-cols-2 gap-3">
        <!-- 7 days -->
        <div
          class="rounded-xl p-4 shadow-sm"
          :class="
            data.projection7d.net >= 0
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          "
        >
          <p class="text-xs font-medium text-gray-600">Proximos 7 dias</p>
          <p
            class="mt-1 text-2xl font-bold"
            :class="
              data.projection7d.net >= 0 ? 'text-green-700' : 'text-red-600'
            "
          >
            {{ data.projection7d.net >= 0 ? "+" : "" }}${{
              data.projection7d.net.toFixed(0)
            }}
          </p>
          <div class="mt-2 space-y-0.5 text-xs text-gray-500">
            <p>Ingresos: ${{ data.projection7d.revenue.toFixed(0) }}</p>
            <p>Gastos: ${{ data.projection7d.expenses.toFixed(0) }}</p>
          </div>
        </div>

        <!-- 30 days -->
        <div
          class="rounded-xl p-4 shadow-sm"
          :class="
            data.projection30d.net >= 0
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          "
        >
          <p class="text-xs font-medium text-gray-600">Proximos 30 dias</p>
          <p
            class="mt-1 text-2xl font-bold"
            :class="
              data.projection30d.net >= 0 ? 'text-green-700' : 'text-red-600'
            "
          >
            {{ data.projection30d.net >= 0 ? "+" : "" }}${{
              data.projection30d.net.toFixed(0)
            }}
          </p>
          <div class="mt-2 space-y-0.5 text-xs text-gray-500">
            <p>Ingresos: ${{ data.projection30d.revenue.toFixed(0) }}</p>
            <p>Gastos: ${{ data.projection30d.expenses.toFixed(0) }}</p>
          </div>
        </div>
      </div>

      <!-- Daily averages -->
      <div class="mt-4 grid grid-cols-2 gap-3">
        <div class="rounded-xl bg-white p-4 shadow-sm">
          <p class="text-xs text-gray-500">Promedio diario ingresos</p>
          <p class="mt-1 text-lg font-bold text-gray-900">
            ${{ data.avgDailyRevenue.toFixed(2) }}
          </p>
        </div>
        <div class="rounded-xl bg-white p-4 shadow-sm">
          <p class="text-xs text-gray-500">Promedio diario gastos</p>
          <p class="mt-1 text-lg font-bold text-gray-900">
            ${{ data.avgDailyExpenses.toFixed(2) }}
          </p>
        </div>
      </div>

      <!-- Pending accounts -->
      <div class="mt-4 grid grid-cols-2 gap-3">
        <NuxtLink
          to="/accounts"
          class="rounded-xl bg-white p-4 shadow-sm hover:bg-gray-50"
        >
          <p class="text-xs text-gray-500">Te deben (por cobrar)</p>
          <p class="mt-1 text-lg font-bold text-yellow-600">
            ${{ data.pendingReceivable.toFixed(2) }}
          </p>
        </NuxtLink>
        <div class="rounded-xl bg-white p-4 shadow-sm">
          <p class="text-xs text-gray-500">Debes (por pagar)</p>
          <p class="mt-1 text-lg font-bold text-red-600">
            ${{ data.pendingPayable.toFixed(2) }}
          </p>
        </div>
      </div>

      <!-- Trend chart (last 14 days) -->
      <div
        v-if="data.trend.dailyRevenue.length > 0"
        class="mt-6 rounded-xl bg-white p-5 shadow-sm"
      >
        <h2 class="mb-4 text-sm font-semibold text-gray-700">
          Ultimos 14 dias
        </h2>
        <SharedBarChart
          :labels="data.trend.dailyRevenue.map((d) => d.date.slice(8))"
          :data="data.trend.dailyRevenue.map((d) => d.revenue)"
          color="#4ade80"
          :height="120"
        />
      </div>

      <!-- AI narrative -->
      <div
        v-if="narrative"
        class="mt-4 rounded-xl bg-blue-50 p-4 text-sm italic text-gray-600"
      >
        "{{ narrative }}"
      </div>
    </template>
  </div>
</template>
