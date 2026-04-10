<script setup lang="ts">
/** Sales by seller ranking report. */
definePageMeta({ middleware: ["admin-only"] });
const narrative = ref("María García lidera con 180 ventas y $2,100 en total. Pedro tiene mejor ticket promedio ($15 vs $11.67).");
const sellers = ref([
  { name: "María García", sales: 180, total: 2100, avgTicket: 11.67, rank: 1 },
  { name: "Pedro Rodríguez", sales: 120, total: 1800, avgTicket: 15.0, rank: 2 },
]);
</script>

<template>
  <SharedReportLayout title="Ventas por vendedor" :narrative="narrative">
    <div class="space-y-3">
      <div v-for="s in sellers" :key="s.name" class="rounded-xl bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-nova-primary text-sm font-bold text-white">{{ s.rank }}</span>
            <div>
              <p class="font-medium text-gray-900">{{ s.name }}</p>
              <p class="text-xs text-gray-500">{{ s.sales }} ventas · ${{ s.avgTicket.toFixed(2) }} ticket prom.</p>
            </div>
          </div>
          <p class="text-lg font-bold text-gray-900">${{ s.total.toFixed(0) }}</p>
        </div>
      </div>
    </div>
  </SharedReportLayout>
</template>
