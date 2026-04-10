<script setup lang="ts">
/**
 * Accounting page - bridge to the accountant.
 * Export Excel with libro diario format, send via WhatsApp.
 * Admin only.
 */

definePageMeta({ middleware: ["admin-only"] });

const isExporting = ref(false);

async function exportAndSend() {
  isExporting.value = true;
  try {
    // TODO: Call POST /api/accounting/export
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const text = encodeURIComponent(
      "Hola, aquí está el reporte contable de este mes. Incluye libro diario, resumen de ventas y gastos.",
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  } finally {
    isExporting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="mb-6 text-xl font-bold text-gray-900">Contabilidad</h1>

    <p class="mb-6 text-sm text-gray-500">
      Nova genera la información que tu contador necesita en el formato que su
      sistema entiende. No es un módulo contable completo -- es un puente.
    </p>

    <!-- Export package -->
    <div class="rounded-xl bg-white p-6 shadow-sm">
      <h2 class="mb-2 text-sm font-semibold text-gray-700">
        Paquete para el contador
      </h2>
      <p class="mb-4 text-xs text-gray-500">
        Genera un Excel con formato de libro diario (fecha, cuenta, debe, haber)
        + resumen de ventas y gastos + P&L simplificado.
      </p>

      <div class="space-y-3">
        <div
          class="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
        >
          <div>
            <p class="text-sm font-medium text-gray-900">Libro diario</p>
            <p class="text-xs text-gray-500">Asientos contables del período</p>
          </div>
          <span class="text-xs text-gray-400">Excel</span>
        </div>
        <div
          class="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
        >
          <div>
            <p class="text-sm font-medium text-gray-900">Resumen de ventas</p>
            <p class="text-xs text-gray-500">Por método de pago y categoría</p>
          </div>
          <span class="text-xs text-gray-400">Excel</span>
        </div>
        <div
          class="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
        >
          <div>
            <p class="text-sm font-medium text-gray-900">Resumen de gastos</p>
            <p class="text-xs text-gray-500">Por proveedor y categoría</p>
          </div>
          <span class="text-xs text-gray-400">Excel</span>
        </div>
        <div
          class="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
        >
          <div>
            <p class="text-sm font-medium text-gray-900">
              Estado de resultados
            </p>
            <p class="text-xs text-gray-500">P&L simplificado del período</p>
          </div>
          <span class="text-xs text-gray-400">PDF</span>
        </div>
      </div>

      <button
        class="mt-6 w-full rounded-xl bg-green-600 py-3 font-medium text-white disabled:opacity-50"
        :disabled="isExporting"
        @click="exportAndSend"
      >
        {{ isExporting ? "Generando..." : "Enviar al contador por WhatsApp" }}
      </button>
    </div>

    <!-- SENIAT books -->
    <div class="mt-4 rounded-xl bg-white p-6 shadow-sm">
      <h2 class="mb-2 text-sm font-semibold text-gray-700">Libros SENIAT</h2>
      <p class="mb-4 text-xs text-gray-500">
        Libro de compras y ventas en formato requerido por el SENIAT.
      </p>
      <div class="flex gap-3">
        <button
          class="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
        >
          Libro de ventas
        </button>
        <button
          class="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
        >
          Libro de compras
        </button>
      </div>
    </div>

    <!-- OCR link -->
    <NuxtLink
      to="/inventory/import"
      class="mt-4 block rounded-xl bg-white p-6 shadow-sm transition-colors hover:bg-gray-50"
    >
      <div class="flex items-center gap-4">
        <span class="text-3xl">📷</span>
        <div>
          <p class="font-medium text-gray-900">Escanear factura</p>
          <p class="text-xs text-gray-500">
            Toma foto de una factura y Nova la registra automáticamente
          </p>
        </div>
      </div>
    </NuxtLink>
  </div>
</template>
