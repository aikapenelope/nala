<script setup lang="ts">
/** Inventory movement report. */
definePageMeta({ middleware: ["admin-only"] });
const narrative = ref("150 productos activos con valor total de $4,500. 3 productos en stock crítico y 5 sin movimiento en 60+ días.");
</script>

<template>
  <SharedReportLayout title="Movimiento de inventario" :narrative="narrative">
    <div class="mb-4 grid grid-cols-4 gap-3">
      <div class="rounded-xl bg-white p-4 text-center shadow-sm"><p class="text-2xl font-bold text-gray-900">150</p><p class="text-xs text-gray-500">Productos</p></div>
      <div class="rounded-xl bg-white p-4 text-center shadow-sm"><p class="text-2xl font-bold text-gray-900">$4,500</p><p class="text-xs text-gray-500">Valor total</p></div>
      <div class="rounded-xl bg-white p-4 text-center shadow-sm"><p class="text-2xl font-bold text-red-600">3</p><p class="text-xs text-gray-500">Stock crítico</p></div>
      <div class="rounded-xl bg-white p-4 text-center shadow-sm"><p class="text-2xl font-bold text-gray-400">5</p><p class="text-xs text-gray-500">Sin movimiento</p></div>
    </div>
    <div class="rounded-xl bg-white p-5 shadow-sm">
      <h3 class="mb-3 text-sm font-semibold text-gray-700">Movimientos del período</h3>
      <div class="grid grid-cols-3 gap-4 text-center">
        <div><p class="text-xl font-bold text-green-600">45</p><p class="text-xs text-gray-500">Entradas</p></div>
        <div><p class="text-xl font-bold text-red-600">320</p><p class="text-xs text-gray-500">Salidas (ventas)</p></div>
        <div><p class="text-xl font-bold text-yellow-600">3</p><p class="text-xs text-gray-500">Ajustes</p></div>
      </div>
    </div>
  </SharedReportLayout>
</template>
