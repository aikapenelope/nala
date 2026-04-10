<script setup lang="ts">
/** Accounts receivable aging report. */
definePageMeta({ middleware: ["admin-only"] });
const narrative = ref("$285 pendientes de cobro. $65 tienen más de 30 días (rojo). Sugerencia: enviar recordatorio a Juan Pérez y Pedro López.");
const debtors = ref([
  { name: "Pedro López", amount: 100, days: 45, color: "text-red-600 bg-red-50" },
  { name: "Juan Pérez", amount: 65, days: 35, color: "text-red-600 bg-red-50" },
  { name: "Carlos Díaz", amount: 70, days: 22, color: "text-yellow-600 bg-yellow-50" },
  { name: "Ana Rodríguez", amount: 25, days: 8, color: "text-green-600 bg-green-50" },
  { name: "Luis Martínez", amount: 25, days: 5, color: "text-green-600 bg-green-50" },
]);
</script>

<template>
  <SharedReportLayout title="Cuentas por cobrar" :narrative="narrative">
    <div class="mb-4 grid grid-cols-3 gap-3">
      <div class="rounded-xl bg-green-50 p-4 text-center"><p class="text-xl font-bold text-green-700">$50</p><p class="text-xs text-green-600">&lt;15 días</p></div>
      <div class="rounded-xl bg-yellow-50 p-4 text-center"><p class="text-xl font-bold text-yellow-700">$70</p><p class="text-xs text-yellow-600">15-30 días</p></div>
      <div class="rounded-xl bg-red-50 p-4 text-center"><p class="text-xl font-bold text-red-700">$165</p><p class="text-xs text-red-600">&gt;30 días</p></div>
    </div>
    <div class="rounded-xl bg-white shadow-sm overflow-hidden">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50"><tr><th class="px-5 py-3 font-medium text-gray-500">Cliente</th><th class="px-5 py-3 text-right font-medium text-gray-500">Monto</th><th class="px-5 py-3 text-right font-medium text-gray-500">Días</th></tr></thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="d in debtors" :key="d.name">
            <td class="px-5 py-3 font-medium text-gray-900">{{ d.name }}</td>
            <td class="px-5 py-3 text-right text-gray-900">${{ d.amount.toFixed(2) }}</td>
            <td class="px-5 py-3 text-right"><span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="d.color">{{ d.days }}d</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </SharedReportLayout>
</template>
