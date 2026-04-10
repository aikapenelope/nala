<script setup lang="ts">
/** Weekly/monthly summary report. */
definePageMeta({ middleware: ["admin-only"] });

const narrative = ref(
  "Esta semana vendiste $3,270, 8% más que la anterior. Tu mejor día fue sábado con $780. Producto estrella: Pan Campesino.",
);

const weeklyData = ref([
  { day: "Lu", amount: 420 },
  { day: "Ma", amount: 350 },
  { day: "Mi", amount: 520 },
  { day: "Ju", amount: 300 },
  { day: "Vi", amount: 620 },
  { day: "Sa", amount: 780 },
  { day: "Do", amount: 280 },
]);
const weeklyMax = computed(() =>
  Math.max(...weeklyData.value.map((d) => d.amount)),
);
</script>

<template>
  <SharedReportLayout title="Resumen semanal" :narrative="narrative">
    <div class="mb-4 grid grid-cols-3 gap-3">
      <div class="rounded-xl bg-white p-4 text-center shadow-sm">
        <p class="text-2xl font-bold text-gray-900">$3,270</p>
        <p class="text-xs text-gray-500">Total semana</p>
      </div>
      <div class="rounded-xl bg-white p-4 text-center shadow-sm">
        <p class="text-2xl font-bold text-green-600">+8%</p>
        <p class="text-xs text-gray-500">vs semana anterior</p>
      </div>
      <div class="rounded-xl bg-white p-4 text-center shadow-sm">
        <p class="text-2xl font-bold text-gray-900">156</p>
        <p class="text-xs text-gray-500">Transacciones</p>
      </div>
    </div>
    <div class="rounded-xl bg-white p-5 shadow-sm">
      <h3 class="mb-3 text-sm font-semibold text-gray-700">Ventas por día</h3>
      <div class="flex items-end gap-2" style="height: 140px">
        <div
          v-for="d in weeklyData"
          :key="d.day"
          class="flex flex-1 flex-col items-center gap-1"
        >
          <span class="text-[10px] text-gray-500">${{ d.amount }}</span>
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
  </SharedReportLayout>
</template>
