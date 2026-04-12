<script setup lang="ts">
/**
 * Financial summary (P&L) report.
 * Connected to: GET /api/reports/financial?period=month
 */
definePageMeta({ middleware: ["admin-only"] });
const { $api } = useApi();
const isLoading = ref(true);
const narrative = ref("");
const period = ref("month");
const data = ref({
  revenue: 0,
  costOfGoods: 0,
  grossProfit: 0,
  expenses: 0,
  netProfit: 0,
  grossMargin: 0,
  netMargin: 0,
});

async function fetchReport() {
  isLoading.value = true;
  try {
    const result = await $api<{ data: typeof data.value; narrative: string }>(
      `/api/reports/financial?period=${period.value}`,
    );
    data.value = result.data;
    narrative.value = result.narrative;
  } catch {
    /* empty state */
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchReport);
watch(period, fetchReport);
</script>
<template>
  <SharedReportLayout
    v-model="period"
    title="Resumen financiero"
    :narrative="narrative"
  >
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
    </div>
    <template v-else>
      <div class="space-y-4">
        <!-- Revenue -->
        <div class="rounded-xl bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Ingresos (ventas)</span>
            <span class="text-lg font-bold text-gray-900"
              >${{ data.revenue.toFixed(2) }}</span
            >
          </div>
        </div>

        <!-- COGS -->
        <div class="rounded-xl bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Costo de ventas</span>
            <span class="text-lg font-bold text-red-600"
              >-${{ data.costOfGoods.toFixed(2) }}</span
            >
          </div>
        </div>

        <!-- Gross profit -->
        <div class="rounded-xl bg-blue-50 p-5">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-blue-800"
              >Ganancia bruta</span
            >
            <div class="text-right">
              <span class="text-lg font-bold text-blue-900"
                >${{ data.grossProfit.toFixed(2) }}</span
              >
              <span class="ml-2 text-xs text-blue-600"
                >{{ data.grossMargin }}%</span
              >
            </div>
          </div>
        </div>

        <!-- Expenses -->
        <div class="rounded-xl bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Gastos operativos</span>
            <span class="text-lg font-bold text-red-600"
              >-${{ data.expenses.toFixed(2) }}</span
            >
          </div>
        </div>

        <!-- Net profit -->
        <div
          class="rounded-xl p-5"
          :class="data.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'"
        >
          <div class="flex items-center justify-between">
            <span
              class="text-sm font-medium"
              :class="data.netProfit >= 0 ? 'text-green-800' : 'text-red-800'"
              >Ganancia neta</span
            >
            <div class="text-right">
              <span
                class="text-xl font-bold"
                :class="data.netProfit >= 0 ? 'text-green-900' : 'text-red-900'"
                >${{ data.netProfit.toFixed(2) }}</span
              >
              <span
                class="ml-2 text-xs"
                :class="data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'"
                >{{ data.netMargin }}%</span
              >
            </div>
          </div>
        </div>
      </div>
    </template>
  </SharedReportLayout>
</template>
