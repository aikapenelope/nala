<script setup lang="ts">
/**
 * Daily summary report.
 * Chart + table + AI narrative.
 */

definePageMeta({ middleware: ["admin-only"] });

const narrative = ref(
  "Hoy vendiste $420 en 23 transacciones, 12% más que el martes pasado. " +
    "Tu producto estrella fue Pan Campesino con 85 unidades. " +
    "El efectivo representó el 68% de las ventas.",
);

const salesByMethod = ref([
  { method: "Efectivo", count: 15, amount: 285.0, percent: 68 },
  { method: "Pago Móvil", count: 5, amount: 85.0, percent: 20 },
  { method: "Binance", count: 2, amount: 30.0, percent: 7 },
  { method: "Fiado", count: 1, amount: 20.0, percent: 5 },
]);

const topProducts = ref([
  { name: "Pan Campesino", qty: 85, total: 127.5, margin: 47 },
  { name: "Café con Leche", qty: 42, total: 42.0, margin: 60 },
  { name: "Queso Blanco", qty: 15, total: 45.0, margin: 33 },
  { name: "Harina PAN", qty: 12, total: 24.0, margin: 25 },
  { name: "Aceite Diana", qty: 8, total: 36.0, margin: 33 },
]);
</script>

<template>
  <SharedReportLayout title="Resumen del día" :narrative="narrative">
    <!-- Summary cards -->
    <div class="mb-4 grid grid-cols-4 gap-3">
      <div class="rounded-xl bg-white p-4 text-center shadow-sm">
        <p class="text-2xl font-bold text-gray-900">$420</p>
        <p class="text-xs text-gray-500">Ventas</p>
      </div>
      <div class="rounded-xl bg-white p-4 text-center shadow-sm">
        <p class="text-2xl font-bold text-gray-900">23</p>
        <p class="text-xs text-gray-500">Transacciones</p>
      </div>
      <div class="rounded-xl bg-white p-4 text-center shadow-sm">
        <p class="text-2xl font-bold text-green-600">+12%</p>
        <p class="text-xs text-gray-500">vs ayer</p>
      </div>
      <div class="rounded-xl bg-white p-4 text-center shadow-sm">
        <p class="text-2xl font-bold text-gray-900">$18.26</p>
        <p class="text-xs text-gray-500">Ticket prom.</p>
      </div>
    </div>

    <!-- Sales by method -->
    <div class="mb-4 rounded-xl bg-white p-5 shadow-sm">
      <h3 class="mb-3 text-sm font-semibold text-gray-700">
        Ventas por método
      </h3>
      <div class="space-y-2">
        <div
          v-for="m in salesByMethod"
          :key="m.method"
          class="flex items-center gap-3"
        >
          <span class="w-24 text-sm text-gray-600">{{ m.method }}</span>
          <div class="flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
            <div
              class="h-full rounded-full bg-nova-primary"
              :style="{ width: `${m.percent}%` }"
            />
          </div>
          <span class="w-16 text-right text-sm font-medium text-gray-900"
            >${{ m.amount.toFixed(0) }}</span
          >
          <span class="w-8 text-right text-xs text-gray-400">{{
            m.count
          }}</span>
        </div>
      </div>
    </div>

    <!-- Top products table -->
    <div class="rounded-xl bg-white shadow-sm overflow-hidden">
      <h3 class="px-5 pt-4 text-sm font-semibold text-gray-700">
        Top productos
      </h3>
      <table class="w-full text-left text-sm mt-2">
        <thead class="border-b bg-gray-50">
          <tr>
            <th class="px-5 py-2 font-medium text-gray-500">#</th>
            <th class="px-5 py-2 font-medium text-gray-500">Producto</th>
            <th class="px-5 py-2 font-medium text-gray-500 text-right">
              Cant.
            </th>
            <th class="px-5 py-2 font-medium text-gray-500 text-right">
              Total
            </th>
            <th class="px-5 py-2 font-medium text-gray-500 text-right">
              Margen
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="(p, i) in topProducts" :key="p.name">
            <td class="px-5 py-2 text-gray-400">{{ i + 1 }}</td>
            <td class="px-5 py-2 font-medium text-gray-900">{{ p.name }}</td>
            <td class="px-5 py-2 text-right text-gray-700">{{ p.qty }}</td>
            <td class="px-5 py-2 text-right text-gray-900">
              ${{ p.total.toFixed(2) }}
            </td>
            <td class="px-5 py-2 text-right text-gray-500">{{ p.margin }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </SharedReportLayout>
</template>
