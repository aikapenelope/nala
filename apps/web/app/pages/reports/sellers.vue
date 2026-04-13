<script setup lang="ts">
/**
 * Sales by seller report.
 *
 * Connected to:
 * - GET /api/reports/sellers?period=week (period report)
 */
definePageMeta({ middleware: ["admin-only"] });
const { $api } = useApi();
const isLoading = ref(true);
const narrative = ref("");
const period = ref("week");
const sellers = ref<
  Array<{ name: string; sales: number; total: number; avgTicket: number }>
>([]);

async function fetchReport() {
  isLoading.value = true;
  try {
    const result = await $api<{
      data: { sellers: typeof sellers.value };
      narrative: string;
    }>(`/api/reports/sellers?period=${period.value}`);
    sellers.value = result.data.sellers;
    narrative.value = result.narrative;
  } catch {
    /* empty state */
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchReport();
});
watch(period, fetchReport);
</script>
<template>
  <SharedReportLayout
    v-model="period"
    title="Ventas por vendedor"
    :narrative="narrative"
  >
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
    </div>
    <div
      v-else-if="sellers.length === 0"
      class="py-12 text-center text-gray-400"
    >
      Sin datos de vendedores
    </div>
    <div v-else class="overflow-hidden rounded-xl bg-white shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50">
          <tr>
            <th class="px-4 py-3 font-medium text-gray-500">#</th>
            <th class="px-4 py-3 font-medium text-gray-500">Vendedor</th>
            <th class="px-4 py-3 text-right font-medium text-gray-500">
              Ventas
            </th>
            <th class="px-4 py-3 text-right font-medium text-gray-500">
              Total
            </th>
            <th class="px-4 py-3 text-right font-medium text-gray-500">
              Ticket prom.
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="(s, i) in sellers" :key="s.name">
            <td class="px-4 py-3 text-gray-400">{{ i + 1 }}</td>
            <td class="px-4 py-3 font-medium text-gray-900">{{ s.name }}</td>
            <td class="px-4 py-3 text-right text-gray-700">{{ s.sales }}</td>
            <td class="px-4 py-3 text-right font-medium text-gray-900">
              ${{ s.total.toFixed(2) }}
            </td>
            <td class="px-4 py-3 text-right text-gray-500">
              ${{ s.avgTicket.toFixed(2) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </SharedReportLayout>
</template>
