<script setup lang="ts">
/**
 * Financial summary report (simplified P&L).
 * Revenue - Cost of Goods - Expenses = Net Profit.
 * Both USD and Bs. columns.
 */

definePageMeta({ middleware: ["admin-only"] });

const exchangeRate = ref(36.5);

const narrative = ref(
  "Este mes tu ganancia neta fue $860, con un margen del 26%. " +
  "Los costos de mercancía representan el 60% de los ingresos. " +
  "Sugerencia: revisa los productos con margen menor al 20%.",
);

const data = ref({
  revenue: 3270.0,
  costOfGoods: 1960.0,
  grossProfit: 1310.0,
  expenses: [
    { name: "Alquiler", amount: 200.0 },
    { name: "Servicios", amount: 80.0 },
    { name: "Salarios", amount: 120.0 },
    { name: "Otros", amount: 50.0 },
  ],
  totalExpenses: 450.0,
  netProfit: 860.0,
  grossMargin: 40.1,
  netMargin: 26.3,
});

function toBs(usd: number): string {
  return (usd * exchangeRate.value).toFixed(2);
}
</script>

<template>
  <SharedReportLayout title="Resumen financiero" :narrative="narrative">
    <!-- P&L Table -->
    <div class="rounded-xl bg-white shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead class="border-b bg-gray-50">
          <tr>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Concepto</th>
            <th class="px-5 py-3 text-right font-medium text-gray-500">USD</th>
            <th class="px-5 py-3 text-right font-medium text-gray-500">Bs.</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <!-- Revenue -->
          <tr class="bg-green-50/50">
            <td class="px-5 py-3 font-semibold text-gray-900">Ingresos por ventas</td>
            <td class="px-5 py-3 text-right font-semibold text-green-700">${{ data.revenue.toFixed(2) }}</td>
            <td class="px-5 py-3 text-right text-green-600">Bs.{{ toBs(data.revenue) }}</td>
          </tr>

          <!-- COGS -->
          <tr>
            <td class="px-5 py-3 text-gray-700">(-) Costo de mercancía</td>
            <td class="px-5 py-3 text-right text-red-600">${{ data.costOfGoods.toFixed(2) }}</td>
            <td class="px-5 py-3 text-right text-red-500">Bs.{{ toBs(data.costOfGoods) }}</td>
          </tr>

          <!-- Gross profit -->
          <tr class="border-t-2 border-gray-200">
            <td class="px-5 py-3 font-semibold text-gray-900">
              Ganancia bruta
              <span class="ml-1 text-xs font-normal text-gray-400">({{ data.grossMargin }}%)</span>
            </td>
            <td class="px-5 py-3 text-right font-semibold text-gray-900">${{ data.grossProfit.toFixed(2) }}</td>
            <td class="px-5 py-3 text-right text-gray-600">Bs.{{ toBs(data.grossProfit) }}</td>
          </tr>

          <!-- Expenses -->
          <tr v-for="exp in data.expenses" :key="exp.name">
            <td class="px-5 py-2 pl-8 text-gray-600">(-) {{ exp.name }}</td>
            <td class="px-5 py-2 text-right text-gray-600">${{ exp.amount.toFixed(2) }}</td>
            <td class="px-5 py-2 text-right text-gray-500">Bs.{{ toBs(exp.amount) }}</td>
          </tr>

          <tr>
            <td class="px-5 py-3 text-gray-700">Total gastos operativos</td>
            <td class="px-5 py-3 text-right text-red-600">${{ data.totalExpenses.toFixed(2) }}</td>
            <td class="px-5 py-3 text-right text-red-500">Bs.{{ toBs(data.totalExpenses) }}</td>
          </tr>

          <!-- Net profit -->
          <tr class="border-t-2 border-gray-300 bg-blue-50/50">
            <td class="px-5 py-4 font-bold text-gray-900">
              Ganancia neta
              <span class="ml-1 text-xs font-normal text-gray-400">({{ data.netMargin }}%)</span>
            </td>
            <td class="px-5 py-4 text-right text-lg font-bold text-nova-primary">${{ data.netProfit.toFixed(2) }}</td>
            <td class="px-5 py-4 text-right font-semibold text-blue-600">Bs.{{ toBs(data.netProfit) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Margin indicators -->
    <div class="mt-4 grid grid-cols-2 gap-3">
      <div class="rounded-xl bg-white p-4 text-center shadow-sm">
        <p class="text-2xl font-bold text-gray-900">{{ data.grossMargin }}%</p>
        <p class="text-xs text-gray-500">Margen bruto</p>
      </div>
      <div class="rounded-xl bg-white p-4 text-center shadow-sm">
        <p class="text-2xl font-bold text-nova-primary">{{ data.netMargin }}%</p>
        <p class="text-xs text-gray-500">Margen neto</p>
      </div>
    </div>
  </SharedReportLayout>
</template>
