<script setup lang="ts">
/**
 * Inventory status report.
 * Connected to: GET /api/reports/inventory
 */
definePageMeta({ middleware: ["admin-only"] });
const { $api } = useApi();
const isLoading = ref(true);
const narrative = ref("");
const period = ref("today");
const data = ref({
  totalProducts: 0,
  totalValue: 0,
  lowStock: 0,
  criticalStock: 0,
  deadStock: 0,
});

async function fetchReport() {
  isLoading.value = true;
  try {
    const result = await $api<{ data: typeof data.value; narrative: string }>(
      `/api/reports/inventory?period=${period.value}`,
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
    title="Inventario"
    :narrative="narrative"
  >
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
    </div>
    <template v-else>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div class="rounded-xl bg-white p-4 text-center shadow-sm">
          <p class="text-2xl font-bold text-gray-900">
            {{ data.totalProducts }}
          </p>
          <p class="text-xs text-gray-500">Productos</p>
        </div>
        <div class="rounded-xl bg-white p-4 text-center shadow-sm">
          <p class="text-2xl font-bold text-gray-900">
            ${{ data.totalValue.toFixed(0) }}
          </p>
          <p class="text-xs text-gray-500">Valor total</p>
        </div>
        <div class="rounded-xl bg-white p-4 text-center shadow-sm">
          <p class="text-2xl font-bold text-stock-yellow">
            {{ data.lowStock }}
          </p>
          <p class="text-xs text-gray-500">Stock bajo</p>
        </div>
        <div class="rounded-xl bg-white p-4 text-center shadow-sm">
          <p class="text-2xl font-bold text-stock-red">
            {{ data.criticalStock }}
          </p>
          <p class="text-xs text-gray-500">Stock critico</p>
        </div>
        <div class="rounded-xl bg-white p-4 text-center shadow-sm">
          <p class="text-2xl font-bold text-stock-gray">{{ data.deadStock }}</p>
          <p class="text-xs text-gray-500">Sin movimiento</p>
        </div>
      </div>
    </template>
  </SharedReportLayout>
</template>
