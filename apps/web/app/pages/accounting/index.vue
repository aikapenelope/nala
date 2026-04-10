<script setup lang="ts">
/**
 * Accounting page - bridge to the accountant.
 * Shows chart of accounts, journal entries, and export options.
 *
 * Connected to:
 * - GET /api/accounting/accounts
 * - GET /api/accounting/entries
 */

definePageMeta({ middleware: ["admin-only"] });

const { $api } = useApi();

const isLoading = ref(true);
const loadError = ref("");

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Entry {
  id: string;
  date: string;
  amount: string;
  description: string | null;
  referenceType: string | null;
  debitAccountId: string;
  creditAccountId: string;
}

const accounts = ref<Account[]>([]);
const entries = ref<Entry[]>([]);

onMounted(async () => {
  try {
    const [accResult, entResult] = await Promise.all([
      $api<{ accounts: Account[] }>("/api/accounting/accounts"),
      $api<{ entries: Entry[] }>("/api/accounting/entries"),
    ]);

    accounts.value = accResult.accounts;
    entries.value = entResult.entries;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando contabilidad";
    loadError.value = message;
  } finally {
    isLoading.value = false;
  }
});

/** Get account name by ID. */
function accountName(id: string): string {
  return accounts.value.find((a) => a.id === id)?.name ?? id.slice(0, 8);
}

/** Format date. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Export placeholder -- sends WhatsApp with summary. */
function exportAndSend() {
  const text = encodeURIComponent(
    "Hola, aqui esta el reporte contable de este mes. Incluye libro diario, resumen de ventas y gastos.",
  );
  window.open(`https://wa.me/?text=${text}`, "_blank");
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="mb-6 text-xl font-bold text-gray-900">Contabilidad</h1>

    <p class="mb-6 text-sm text-gray-500">
      Nova genera la informacion que tu contador necesita en el formato que su
      sistema entiende. No es un modulo contable completo -- es un puente.
    </p>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando contabilidad...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
    </div>

    <template v-else>
      <!-- Chart of accounts -->
      <div
        v-if="accounts.length > 0"
        class="mb-6 rounded-xl bg-white p-6 shadow-sm"
      >
        <h2 class="mb-4 text-sm font-semibold text-gray-700">
          Catalogo de cuentas
        </h2>
        <div class="space-y-2">
          <div
            v-for="acc in accounts"
            :key="acc.id"
            class="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2 text-sm"
          >
            <span class="font-mono text-gray-500">{{ acc.code }}</span>
            <span class="text-gray-900">{{ acc.name }}</span>
            <span class="text-xs text-gray-400">{{ acc.type }}</span>
          </div>
        </div>
      </div>

      <!-- Recent journal entries -->
      <div
        v-if="entries.length > 0"
        class="mb-6 rounded-xl bg-white p-6 shadow-sm"
      >
        <h2 class="mb-4 text-sm font-semibold text-gray-700">
          Ultimos asientos ({{ entries.length }})
        </h2>
        <div class="space-y-3">
          <div
            v-for="entry in entries.slice(0, 20)"
            :key="entry.id"
            class="rounded-lg border border-gray-100 p-3 text-sm"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">{{
                formatDate(entry.date)
              }}</span>
              <span class="font-medium text-gray-900"
                >${{ Number(entry.amount).toFixed(2) }}</span
              >
            </div>
            <p v-if="entry.description" class="mt-1 text-xs text-gray-600">
              {{ entry.description }}
            </p>
            <div class="mt-1 flex gap-2 text-xs text-gray-400">
              <span>Debe: {{ accountName(entry.debitAccountId) }}</span>
              <span>Haber: {{ accountName(entry.creditAccountId) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Export package -->
      <div class="rounded-xl bg-white p-6 shadow-sm">
        <h2 class="mb-2 text-sm font-semibold text-gray-700">
          Paquete para el contador
        </h2>
        <p class="mb-4 text-xs text-gray-500">
          Genera un Excel con formato de libro diario (fecha, cuenta, debe,
          haber) + resumen de ventas y gastos + P&L simplificado.
        </p>

        <button
          class="w-full rounded-xl bg-green-600 py-3 font-medium text-white"
          @click="exportAndSend"
        >
          Enviar al contador por WhatsApp
        </button>
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
              Toma foto de una factura y Nova la registra automaticamente
            </p>
          </div>
        </div>
      </NuxtLink>
    </template>
  </div>
</template>
