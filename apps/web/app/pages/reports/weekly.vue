<script setup lang="ts">
/**
 * Weekly/monthly summary report.
 * Connected to: GET /api/reports/weekly?period=week
 */
definePageMeta({ middleware: ["admin-only"] });
const { $api } = useApi();
const isLoading = ref(true);
const narrative = ref("");
const data = ref({
  totalSales: 0,
  totalCount: 0,
  vsPrevPeriod: 0,
  dailyBreakdown: [] as Array<{ day: string; amount: number }>,
  bestDay: null as string | null,
  topProduct: null as string | null,
});
const weeklyMax = computed(() =>
  Math.max(...data.value.dailyBreakdown.map((d) => d.amount), 1),
);

onMounted(async () => {
  try {
    const result = await $api<{ data: typeof data.value; narrative: string }>(
      "/api/reports/weekly?period=week",
    );
    data.value = result.data;
    narrative.value = result.narrative;
  } catch {
    /* handled by empty state */
  } finally {
    isLoading.value = false;
  }
});
</script>
<template>
  <SharedReportLayout title="Resumen semanal" :narrative="narrative">
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
    </div>
    <template v-else>
      <div class="mb-4 grid grid-cols-3 gap-3">
        <div class="rounded-xl bg-white p-4 text-center shadow-sm">
          <p class="text-2xl font-bold text-gray-900">
            ${{ data.totalSales.toFixed(0) }}
          </p>
          <p class="text-xs text-gray-500">Total</p>
        </div>
        <div class="rounded-xl bg-white p-4 text-center shadow-sm">
          <p class="text-2xl font-bold text-gray-900">{{ data.totalCount }}</p>
          <p class="text-xs text-gray-500">Ventas</p>
        </div>
        <div class="rounded-xl bg-white p-4 text-center shadow-sm">
          <p
            class="text-2xl font-bold"
            :class="data.vsPrevPeriod >= 0 ? 'text-green-600' : 'text-red-600'"
          >
            {{ data.vsPrevPeriod >= 0 ? "+" : "" }}{{ data.vsPrevPeriod }}%
          </p>
          <p class="text-xs text-gray-500">vs anterior</p>
        </div>
      </div>
      <div
        v-if="data.dailyBreakdown.length > 0"
        class="rounded-xl bg-white p-5 shadow-sm"
      >
        <h3 class="mb-4 text-sm font-semibold text-gray-700">
          Desglose diario
        </h3>
        <div class="flex items-end gap-2" style="height: 120px">
          <div
            v-for="d in data.dailyBreakdown"
            :key="d.day"
            class="flex flex-1 flex-col items-center gap-1"
          >
            <span class="text-[10px] text-gray-500"
              >${{ d.amount.toFixed(0) }}</span
            >
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
      </div>
      <div
        v-if="data.bestDay || data.topProduct"
        class="mt-4 text-sm text-gray-500"
      >
        <span v-if="data.bestDay">Mejor dia: {{ data.bestDay }}</span>
        <span v-if="data.bestDay && data.topProduct"> · </span>
        <span v-if="data.topProduct"
          >Producto estrella: {{ data.topProduct }}</span
        >
      </div>
    </template>
  </SharedReportLayout>
</template>
