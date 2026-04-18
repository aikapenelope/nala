<script setup lang="ts">
/**
 * Monthly trend report - revenue by month for the last 12 months.
 *
 * Connected to:
 * - GET /api/reports/monthly-trend
 */

definePageMeta({ middleware: ["admin-only"] });

const { $api } = useApi();

const isLoading = ref(true);
const loadError = ref("");

interface MonthData {
  month: string;
  revenue: number;
  count: number;
}

const months = ref<MonthData[]>([]);

onMounted(async () => {
  try {
    const result = await $api<{ months: MonthData[] }>(
      "/api/reports/monthly-trend",
    );
    months.value = result.months;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando tendencia";
    loadError.value = message;
  } finally {
    isLoading.value = false;
  }
});

/** Max revenue for bar chart scaling. */
const maxRevenue = computed(() =>
  Math.max(...months.value.map((m) => m.revenue), 1),
);

/** Format month label (e.g., "2026-04" -> "Abr 2026"). */
function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const monthNames = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  return `${monthNames[Number(m) - 1]} ${year}`;
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">Tendencia mensual</h1>
      <NuxtLink
        to="/reports"
        class="text-sm text-gray-500 hover:text-gray-700"
      >
        Volver
      </NuxtLink>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando tendencia...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
    </div>

    <!-- Empty -->
    <div
      v-else-if="months.length === 0"
      class="py-12 text-center text-gray-400"
    >
      No hay datos de ventas aun
    </div>

    <template v-else>
      <!-- Bar chart -->
      <div class="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <div class="space-y-3">
          <div
            v-for="month in months"
            :key="month.month"
            class="flex items-center gap-3"
          >
            <span class="w-20 text-right text-xs text-gray-500">
              {{ formatMonth(month.month) }}
            </span>
            <div class="flex-1">
              <div
                class="h-6 rounded-r bg-nova-primary transition-all"
                :style="{
                  width: `${(month.revenue / maxRevenue) * 100}%`,
                  minWidth: month.revenue > 0 ? '4px' : '0',
                }"
              />
            </div>
            <span class="w-24 text-right text-sm font-medium text-gray-900">
              ${{ month.revenue.toFixed(0) }}
            </span>
            <span class="w-12 text-right text-xs text-gray-400">
              {{ month.count }} v.
            </span>
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="rounded-xl bg-white p-6 shadow-sm">
        <h2 class="mb-3 text-sm font-semibold text-gray-700">Resumen</h2>
        <div class="grid grid-cols-3 gap-4 text-center">
          <div>
            <p class="text-2xl font-bold text-gray-900">
              ${{
                months
                  .reduce((sum, m) => sum + m.revenue, 0)
                  .toFixed(0)
              }}
            </p>
            <p class="text-xs text-gray-500">Total 12 meses</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">
              ${{
                (
                  months.reduce((sum, m) => sum + m.revenue, 0) /
                  Math.max(months.length, 1)
                ).toFixed(0)
              }}
            </p>
            <p class="text-xs text-gray-500">Promedio mensual</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">
              {{ months.reduce((sum, m) => sum + m.count, 0) }}
            </p>
            <p class="text-xs text-gray-500">Ventas totales</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
