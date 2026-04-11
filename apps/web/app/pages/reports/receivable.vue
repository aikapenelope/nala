<script setup lang="ts">
/**
 * Accounts receivable aging report.
 * Connected to: GET /api/reports/receivable
 */
definePageMeta({ middleware: ["admin-only"] });
const { $api } = useApi();
const isLoading = ref(true);
const narrative = ref("");
const data = ref({
  total: 0,
  aging: { green: 0, yellow: 0, red: 0 },
  topDebtors: [] as Array<{ name: string; amount: number; days: number }>,
});

onMounted(async () => {
  try {
    const result = await $api<{ data: typeof data.value; narrative: string }>(
      "/api/reports/receivable",
    );
    data.value = result.data;
    narrative.value = result.narrative;
  } catch {
    /* empty state */
  } finally {
    isLoading.value = false;
  }
});
</script>
<template>
  <SharedReportLayout title="Cuentas por cobrar" :narrative="narrative">
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
    </div>
    <template v-else>
      <div class="mb-4 rounded-xl bg-white p-5 shadow-sm">
        <p class="text-center text-3xl font-bold text-gray-900">
          ${{ data.total.toFixed(2) }}
        </p>
        <p class="text-center text-xs text-gray-500">Total por cobrar</p>
        <div class="mt-4 flex gap-3">
          <div class="flex-1 rounded-lg bg-green-50 p-3 text-center">
            <p class="text-lg font-bold text-green-700">
              ${{ data.aging.green.toFixed(0) }}
            </p>
            <p class="text-[10px] text-green-600">&lt;15 dias</p>
          </div>
          <div class="flex-1 rounded-lg bg-yellow-50 p-3 text-center">
            <p class="text-lg font-bold text-yellow-700">
              ${{ data.aging.yellow.toFixed(0) }}
            </p>
            <p class="text-[10px] text-yellow-600">15-30 dias</p>
          </div>
          <div class="flex-1 rounded-lg bg-red-50 p-3 text-center">
            <p class="text-lg font-bold text-red-700">
              ${{ data.aging.red.toFixed(0) }}
            </p>
            <p class="text-[10px] text-red-600">&gt;30 dias</p>
          </div>
        </div>
      </div>
      <div
        v-if="data.topDebtors.length > 0"
        class="overflow-hidden rounded-xl bg-white shadow-sm"
      >
        <h3 class="px-5 pt-4 text-sm font-semibold text-gray-700">
          Top deudores
        </h3>
        <table class="mt-2 w-full text-left text-sm">
          <thead class="border-b bg-gray-50">
            <tr>
              <th class="px-5 py-2 font-medium text-gray-500">Cliente</th>
              <th class="px-5 py-2 text-right font-medium text-gray-500">
                Monto
              </th>
              <th class="px-5 py-2 text-right font-medium text-gray-500">
                Dias
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="d in data.topDebtors" :key="d.name">
              <td class="px-5 py-2 font-medium text-gray-900">{{ d.name }}</td>
              <td class="px-5 py-2 text-right text-gray-900">
                ${{ d.amount.toFixed(2) }}
              </td>
              <td
                class="px-5 py-2 text-right"
                :class="
                  d.days > 30
                    ? 'text-red-600'
                    : d.days > 15
                      ? 'text-yellow-600'
                      : 'text-green-600'
                "
              >
                {{ d.days }}d
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </SharedReportLayout>
</template>
