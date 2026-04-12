<script setup lang="ts">
/**
 * Daily summary report.
 * Connected to: GET /api/reports/daily
 */

definePageMeta({ middleware: ["admin-only"] });

const { $api } = useApi();
const isLoading = ref(true);
const loadError = ref("");
const narrative = ref("");
const period = ref("today");

const data = ref({
  totalSales: 0,
  totalCount: 0,
  avgTicket: 0,
  vsPreviousDay: 0,
  vsSameDayLastWeek: 0,
  topProducts: [] as Array<{ name: string; qty: number; total: number }>,
  salesByMethod: {} as Record<string, number>,
});

async function fetchReport() {
  isLoading.value = true;
  loadError.value = "";
  try {
    const result = await $api<{
      data: typeof data.value;
      narrative: string;
    }>(`/api/reports/daily?period=${period.value}`);
    data.value = result.data;
    narrative.value = result.narrative;
  } catch (err) {
    loadError.value =
      err instanceof Error ? err.message : "Error cargando reporte";
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchReport);
watch(period, fetchReport);

const methodEntries = computed(() => {
  const entries = Object.entries(data.value.salesByMethod);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return entries.map(([method, amount]) => ({
    method,
    amount,
    percent: total > 0 ? Math.round((amount / total) * 100) : 0,
  }));
});

const methodLabels: Record<string, string> = {
  efectivo: "Efectivo",
  pago_movil: "Pago Movil",
  binance: "Binance",
  zinli: "Zinli",
  transferencia: "Transferencia",
  zelle: "Zelle",
  fiado: "Fiado",
};
</script>

<template>
  <SharedReportLayout
    v-model="period"
    title="Resumen del dia"
    :narrative="narrative"
  >
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
    </div>
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-4 text-sm text-red-600"
    >
      {{ loadError }}
    </div>
    <template v-else>
      <div class="mb-4 grid grid-cols-4 gap-3">
        <div class="rounded-xl bg-white p-4 text-center shadow-sm">
          <p class="text-2xl font-bold text-gray-900">
            ${{ data.totalSales.toFixed(0) }}
          </p>
          <p class="text-xs text-gray-500">Ventas</p>
        </div>
        <div class="rounded-xl bg-white p-4 text-center shadow-sm">
          <p class="text-2xl font-bold text-gray-900">{{ data.totalCount }}</p>
          <p class="text-xs text-gray-500">Transacciones</p>
        </div>
        <div class="rounded-xl bg-white p-4 text-center shadow-sm">
          <p
            class="text-2xl font-bold"
            :class="data.vsPreviousDay >= 0 ? 'text-green-600' : 'text-red-600'"
          >
            {{ data.vsPreviousDay >= 0 ? "+" : "" }}{{ data.vsPreviousDay }}%
          </p>
          <p class="text-xs text-gray-500">vs ayer</p>
        </div>
        <div class="rounded-xl bg-white p-4 text-center shadow-sm">
          <p class="text-2xl font-bold text-gray-900">
            ${{ data.avgTicket.toFixed(2) }}
          </p>
          <p class="text-xs text-gray-500">Ticket prom.</p>
        </div>
      </div>

      <div
        v-if="methodEntries.length > 0"
        class="mb-4 rounded-xl bg-white p-5 shadow-sm"
      >
        <h3 class="mb-3 text-sm font-semibold text-gray-700">
          Ventas por metodo
        </h3>
        <div class="space-y-2">
          <div
            v-for="m in methodEntries"
            :key="m.method"
            class="flex items-center gap-3"
          >
            <span class="w-24 text-sm text-gray-600">{{
              methodLabels[m.method] ?? m.method
            }}</span>
            <div class="h-4 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                class="h-full rounded-full bg-nova-primary"
                :style="{ width: `${m.percent}%` }"
              />
            </div>
            <span class="w-16 text-right text-sm font-medium text-gray-900"
              >${{ m.amount.toFixed(0) }}</span
            >
          </div>
        </div>
      </div>

      <div
        v-if="data.topProducts.length > 0"
        class="overflow-hidden rounded-xl bg-white shadow-sm"
      >
        <h3 class="px-5 pt-4 text-sm font-semibold text-gray-700">
          Top productos
        </h3>
        <table class="mt-2 w-full text-left text-sm">
          <thead class="border-b bg-gray-50">
            <tr>
              <th class="px-5 py-2 font-medium text-gray-500">#</th>
              <th class="px-5 py-2 font-medium text-gray-500">Producto</th>
              <th class="px-5 py-2 text-right font-medium text-gray-500">
                Cant.
              </th>
              <th class="px-5 py-2 text-right font-medium text-gray-500">
                Total
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="(p, i) in data.topProducts" :key="p.name">
              <td class="px-5 py-2 text-gray-400">{{ i + 1 }}</td>
              <td class="px-5 py-2 font-medium text-gray-900">{{ p.name }}</td>
              <td class="px-5 py-2 text-right text-gray-700">{{ p.qty }}</td>
              <td class="px-5 py-2 text-right text-gray-900">
                ${{ p.total.toFixed(2) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </SharedReportLayout>
</template>
