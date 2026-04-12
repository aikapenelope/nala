<script setup lang="ts">
/**
 * Product profitability report.
 * Connected to: GET /api/reports/profitability
 */
definePageMeta({ middleware: ["admin-only"] });
const { $api } = useApi();
const isLoading = ref(true);
const narrative = ref("");
const period = ref("month");
const productData = ref<
  Array<{
    name: string;
    margin: number;
    rotation: number;
    contribution: number;
    score: number;
  }>
>([]);

async function fetchReport() {
  isLoading.value = true;
  try {
    const result = await $api<{
      data: { products: typeof productData.value };
      narrative: string;
    }>(`/api/reports/profitability?period=${period.value}`);
    productData.value = result.data.products;
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
    title="Rentabilidad por producto"
    :narrative="narrative"
  >
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
    </div>
    <div
      v-else-if="productData.length === 0"
      class="py-12 text-center text-gray-400"
    >
      Sin datos de rentabilidad
    </div>
    <div v-else class="overflow-hidden rounded-xl bg-white shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50">
          <tr>
            <th class="px-4 py-3 font-medium text-gray-500">Producto</th>
            <th class="px-4 py-3 text-right font-medium text-gray-500">
              Margen
            </th>
            <th class="px-4 py-3 text-right font-medium text-gray-500">
              Rotacion
            </th>
            <th class="px-4 py-3 text-right font-medium text-gray-500">
              Contribucion
            </th>
            <th class="px-4 py-3 text-right font-medium text-gray-500">
              Score
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="p in productData" :key="p.name">
            <td class="px-4 py-3 font-medium text-gray-900">{{ p.name }}</td>
            <td class="px-4 py-3 text-right text-gray-700">{{ p.margin }}%</td>
            <td class="px-4 py-3 text-right text-gray-700">{{ p.rotation }}</td>
            <td class="px-4 py-3 text-right text-gray-700">
              {{ p.contribution }}%
            </td>
            <td
              class="px-4 py-3 text-right font-medium"
              :class="
                p.score >= 70
                  ? 'text-green-600'
                  : p.score >= 40
                    ? 'text-yellow-600'
                    : 'text-red-600'
              "
            >
              {{ p.score }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </SharedReportLayout>
</template>
