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

const props = defineProps<{
  title: string;
  narrative?: string;
  /** API report path for export (e.g. "/api/reports/daily"). */
  exportPath?: string;
}>();

const period = defineModel<string>({ default: "today" });

const periods = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "last_month", label: "Mes anterior" },
];

const { $api } = useApi();

/** Download a report as PDF from the API. */
async function exportPdf() {
  if (!props.exportPath) {
    alert("Exportacion PDF no disponible para este reporte");
    return;
  }
  try {
    const blob = await $api<Blob>(
      `${props.exportPath}/export?period=${period.value}&format=pdf`,
      { responseType: "blob" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-${new Date().toISOString().split("T")[0]}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    alert("Error generando PDF. Intenta de nuevo.");
  }
}

/** Download a report as Excel from the API. */
async function exportExcel() {
  if (!props.exportPath) {
    alert("Exportacion Excel no disponible para este reporte");
    return;
  }
  try {
    const blob = await $api<Blob>(
      `${props.exportPath}/export-xlsx?period=${period.value}`,
      { responseType: "blob" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    alert("Error generando Excel. Intenta de nuevo.");
  }
}

/** Send report PDF to accountant via email. */
const showEmailModal = ref(false);
const accountantEmail = ref("");
const sendingEmail = ref(false);

function sendToAccountant() {
  showEmailModal.value = true;
}

async function confirmSendEmail() {
  if (!accountantEmail.value || !props.exportPath) return;
  sendingEmail.value = true;

  // Derive reportType from exportPath: "/api/reports/daily" -> "daily"
  const reportType = props.exportPath.split("/").pop() ?? "daily";

  try {
    await $api("/api/reports/send-email", {
      method: "POST",
      body: {
        to: accountantEmail.value,
        reportType,
        period: period.value,
      },
    });
    showEmailModal.value = false;
    alert("Reporte enviado por email.");
  } catch {
    alert("Error enviando email. Verifica la direccion e intenta de nuevo.");
  } finally {
    sendingEmail.value = false;
  }
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

    <!-- Email modal -->
    <div
      v-if="showEmailModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="showEmailModal = false"
    >
      <div class="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h3 class="mb-3 text-lg font-semibold text-gray-900">
          Enviar reporte por email
        </h3>
        <input
          v-model="accountantEmail"
          type="email"
          placeholder="contador@email.com"
          class="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <div class="flex gap-3">
          <button
            class="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
            @click="showEmailModal = false"
          >
            Cancelar
          </button>
          <button
            class="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white disabled:opacity-50"
            :disabled="!accountantEmail || sendingEmail"
            @click="confirmSendEmail"
          >
            {{ sendingEmail ? "Enviando..." : "Enviar" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
