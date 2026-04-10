<script setup lang="ts">
/** Product profitability report. */
definePageMeta({ middleware: ["admin-only"] });
const narrative = ref(
  "Pan Campesino lidera con score 92 (alto margen + alta rotación). Queso Blanco tiene margen bajo (33%) pero buena rotación.",
);
const products = ref([
  {
    name: "Pan Campesino",
    margin: 47,
    rotation: 85,
    contribution: 30,
    score: 92,
  },
  {
    name: "Café con Leche",
    margin: 60,
    rotation: 42,
    contribution: 10,
    score: 78,
  },
  {
    name: "Queso Blanco",
    margin: 33,
    rotation: 15,
    contribution: 11,
    score: 55,
  },
  { name: "Harina PAN", margin: 25, rotation: 12, contribution: 6, score: 40 },
  { name: "Aceite Diana", margin: 33, rotation: 8, contribution: 9, score: 38 },
]);
</script>

<template>
  <SharedReportLayout title="Rentabilidad por producto" :narrative="narrative">
    <div class="rounded-xl bg-white shadow-sm overflow-hidden">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50">
          <tr>
            <th class="px-5 py-3 font-medium text-gray-500">Producto</th>
            <th class="px-5 py-3 text-right font-medium text-gray-500">
              Margen
            </th>
            <th class="px-5 py-3 text-right font-medium text-gray-500">
              Rotación
            </th>
            <th class="px-5 py-3 text-right font-medium text-gray-500">
              Contribución
            </th>
            <th class="px-5 py-3 text-right font-medium text-gray-500">
              Score
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="p in products" :key="p.name">
            <td class="px-5 py-3 font-medium text-gray-900">{{ p.name }}</td>
            <td class="px-5 py-3 text-right text-gray-700">{{ p.margin }}%</td>
            <td class="px-5 py-3 text-right text-gray-700">{{ p.rotation }}</td>
            <td class="px-5 py-3 text-right text-gray-700">
              {{ p.contribution }}%
            </td>
            <td
              class="px-5 py-3 text-right font-semibold"
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
