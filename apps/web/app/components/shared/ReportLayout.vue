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

import { ArrowLeft, Download, FileSpreadsheet, Send } from "lucide-vue-next";

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
        <NuxtLink
          to="/reports"
          class="flex h-8 w-8 items-center justify-center rounded-xl bg-white/60 text-gray-400 transition-spring hover:bg-white hover:text-gray-600"
        >
          <ArrowLeft :size="16" />
        </NuxtLink>
        <h1 class="text-2xl font-extrabold tracking-tight text-gradient">{{ title }}</h1>
      </div>

      <!-- Period selector -->
      <select
        v-model="period"
        class="glass rounded-2xl border-0 px-4 py-2 text-sm font-bold text-gray-700 outline-none"
      >
        <option v-for="p in periods" :key="p.value" :value="p.value">
          {{ p.label }}
        </option>
      </select>
    </div>

    <!-- AI Narrative -->
    <div
      v-if="narrative"
      class="card-premium mb-4 p-4"
    >
      <p class="text-[13px] font-medium italic text-gray-600">
        "{{ narrative }}"
      </p>
    </div>

    <!-- Report content -->
    <slot />

    <!-- Export buttons -->
    <div class="mt-6 flex gap-2.5">
      <button
        class="glass card-lift flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
        @click="exportPdf"
      >
        <Download :size="14" />
        PDF
      </button>
      <button
        class="glass card-lift flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
        @click="exportExcel"
      >
        <FileSpreadsheet :size="14" />
        Excel
      </button>
      <button
        class="dark-pill flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-spring"
        @click="sendToAccountant"
      >
        <Send :size="14" />
        Contador
      </button>
    </div>

    <!-- Email modal -->
    <Teleport to="body">
      <div
        v-if="showEmailModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showEmailModal = false"
      >
        <div class="glass-strong mx-4 w-full max-w-sm rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
          <h3 class="mb-5 text-xl font-extrabold tracking-tight text-gradient">
            Enviar reporte por email
          </h3>
          <input
            v-model="accountantEmail"
            type="email"
            placeholder="contador@email.com"
            class="mb-5 w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
          />
          <div class="flex gap-3">
            <button
              class="glass flex-1 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
              @click="showEmailModal = false"
            >
              Cancelar
            </button>
            <button
              class="dark-pill flex-1 rounded-2xl py-3 text-sm font-bold transition-spring disabled:opacity-50"
              :disabled="!accountantEmail || sendingEmail"
              @click="confirmSendEmail"
            >
              {{ sendingEmail ? "Enviando..." : "Enviar" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
