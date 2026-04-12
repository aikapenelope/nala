<script setup lang="ts">
/**
 * Reusable report layout component.
 * Provides: period selector, export buttons, AI narrative slot, content slot.
 *
 * The period is exposed via v-model so parent report pages can react
 * to period changes and refetch their data.
 *
 * Usage:
 *   <SharedReportLayout v-model="period" title="..." :narrative="...">
 *     <ReportContent />
 *   </SharedReportLayout>
 */

defineProps<{
  title: string;
  narrative?: string;
}>();

const period = defineModel<string>({ default: "today" });

const periods = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "last_month", label: "Mes anterior" },
];

function exportPdf() {
  // TODO: Generate PDF with jsPDF
  alert("Exportacion PDF proximamente");
}

function exportExcel() {
  // TODO: Generate Excel with SheetJS
  alert("Exportacion Excel proximamente");
}

function sendToAccountant() {
  const text = encodeURIComponent(
    "Hola, aqui esta el reporte contable de este periodo.",
  );
  window.open(`https://wa.me/?text=${text}`, "_blank");
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <NuxtLink to="/reports" class="text-gray-400 hover:text-gray-600">
          ←
        </NuxtLink>
        <h1 class="text-xl font-bold text-gray-900">{{ title }}</h1>
      </div>

      <!-- Period selector -->
      <select
        v-model="period"
        class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
      >
        <option v-for="p in periods" :key="p.value" :value="p.value">
          {{ p.label }}
        </option>
      </select>
    </div>

    <!-- AI Narrative -->
    <div
      v-if="narrative"
      class="mb-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 italic"
    >
      "{{ narrative }}"
    </div>

    <!-- Report content -->
    <slot />

    <!-- Export buttons -->
    <div class="mt-6 flex gap-3">
      <button
        class="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
        @click="exportPdf"
      >
        Exportar PDF
      </button>
      <button
        class="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
        @click="exportExcel"
      >
        Exportar Excel
      </button>
      <button
        class="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white"
        @click="sendToAccountant"
      >
        Enviar al contador
      </button>
    </div>
  </div>
</template>
