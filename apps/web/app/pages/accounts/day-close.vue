<script setup lang="ts">
/**
 * Day close - end-of-day cash reconciliation.
 * 3 steps: count cash, review comparison, confirm.
 *
 * Connected to:
 * - GET /api/reports/daily (today's summary for context)
 * - POST /api/day-close (record the close)
 */

definePageMeta({ middleware: ["admin-only"] });

const router = useRouter();
const { $api } = useApi();

type CloseStep = "count" | "review" | "done";
const step = ref<CloseStep>("count");
const cashCounted = ref<number | null>(null);
const notes = ref("");
const isSubmitting = ref(false);
const isLoadingSummary = ref(true);
const loadError = ref("");
const submitError = ref("");

/** Day summary from API. */
const daySummary = ref({
  totalSalesUsd: 0,
  totalSalesCount: 0,
  cashExpected: 0,
  salesByMethod: [] as Array<{ method: string; total: number }>,
  topProducts: [] as Array<{ name: string; qty: number; total: number }>,
});

/** Load today's summary on mount. */
onMounted(async () => {
  try {
    const daily = await $api<{
      data: {
        totalSales: number;
        totalCount: number;
        salesByMethod: Record<string, number>;
        topProducts: Array<{ name: string; qty: number; total: number }>;
      };
    }>("/api/reports/daily");

    daySummary.value.totalSalesUsd = daily.data.totalSales;
    daySummary.value.totalSalesCount = daily.data.totalCount;
    daySummary.value.topProducts = daily.data.topProducts.slice(0, 5);

    // Convert salesByMethod object to array
    daySummary.value.salesByMethod = Object.entries(
      daily.data.salesByMethod,
    ).map(([method, total]) => ({ method, total }));

    // cashExpected = efectivo amount from salesByMethod
    daySummary.value.cashExpected = daily.data.salesByMethod["efectivo"] ?? 0;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando resumen";
    loadError.value = message;
  } finally {
    isLoadingSummary.value = false;
  }
});

const cashDifference = computed(() => {
  if (cashCounted.value === null) return 0;
  return (
    Math.round((cashCounted.value - daySummary.value.cashExpected) * 100) / 100
  );
});

const hasDiscrepancy = computed(() => Math.abs(cashDifference.value) > 0.5);

function proceedToReview() {
  if (cashCounted.value === null || cashCounted.value < 0) return;
  step.value = "review";
}

/** Method display labels. */
const methodLabels: Record<string, string> = {
  efectivo: "Efectivo",
  pago_movil: "Pago Movil",
  binance: "Binance",
  zinli: "Zinli",
  transferencia: "Transferencia",
  zelle: "Zelle",
  fiado: "Fiado",
};

async function confirmClose() {
  if (cashCounted.value === null) return;

  isSubmitting.value = true;
  submitError.value = "";

  try {
    await $api("/api/day-close", {
      method: "POST",
      body: {
        cashCounted: cashCounted.value,
        notes: notes.value || undefined,
      },
    });

    step.value = "done";
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    submitError.value = fetchError.data?.error ?? "Error al cerrar el dia";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg">
    <h1 class="mb-6 text-xl font-bold text-gray-900">Cierre del dia</h1>

    <!-- Loading -->
    <div v-if="isLoadingSummary" class="py-12 text-center text-gray-400">
      Cargando resumen del dia...
    </div>

    <!-- Load error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
    </div>

    <template v-else>
      <!-- Step 1: Count -->
      <div v-if="step === 'count'" class="space-y-6">
        <div class="rounded-xl bg-white p-6 shadow-sm">
          <h2 class="mb-1 text-sm font-semibold text-gray-700">
            Resumen de hoy
          </h2>
          <div class="mt-4 grid grid-cols-2 gap-4 text-center">
            <div>
              <p class="text-2xl font-bold text-gray-900">
                ${{ daySummary.totalSalesUsd.toFixed(0) }}
              </p>
              <p class="text-xs text-gray-500">Ventas totales</p>
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900">
                {{ daySummary.totalSalesCount }}
              </p>
              <p class="text-xs text-gray-500">Transacciones</p>
            </div>
          </div>
          <div
            v-if="daySummary.salesByMethod.length > 0"
            class="mt-4 space-y-2"
          >
            <div
              v-for="m in daySummary.salesByMethod"
              :key="m.method"
              class="flex items-center justify-between text-sm"
            >
              <span class="text-gray-600">{{
                methodLabels[m.method] ?? m.method
              }}</span>
              <span class="font-medium text-gray-900"
                >${{ m.total.toFixed(2) }}</span
              >
            </div>
          </div>
        </div>

        <div class="rounded-xl bg-white p-6 shadow-sm">
          <h2 class="mb-4 text-sm font-semibold text-gray-700">
            Cuanto efectivo hay en caja?
          </h2>
          <div class="flex items-center gap-2">
            <span class="text-2xl text-gray-400">$</span>
            <input
              v-model.number="cashCounted"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              class="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-2xl font-bold focus:border-nova-primary focus:outline-none"
              autofocus
            />
          </div>
          <p class="mt-2 text-xs text-gray-400">
            Esperado en efectivo: ${{ daySummary.cashExpected.toFixed(2) }}
          </p>
        </div>

        <button
          class="w-full rounded-xl bg-nova-primary py-3 font-medium text-white disabled:opacity-50"
          :disabled="cashCounted === null || cashCounted < 0"
          @click="proceedToReview"
        >
          Revisar cierre
        </button>
      </div>

      <!-- Step 2: Review -->
      <div v-else-if="step === 'review'" class="space-y-6">
        <div class="rounded-xl bg-white p-6 shadow-sm">
          <div class="grid grid-cols-2 gap-4 text-center">
            <div>
              <p class="text-sm text-gray-500">Contado</p>
              <p class="text-2xl font-bold text-gray-900">
                ${{ (cashCounted ?? 0).toFixed(2) }}
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Esperado</p>
              <p class="text-2xl font-bold text-gray-900">
                ${{ daySummary.cashExpected.toFixed(2) }}
              </p>
            </div>
          </div>
          <div
            class="mt-4 rounded-lg p-3 text-center"
            :class="
              hasDiscrepancy
                ? cashDifference > 0
                  ? 'bg-yellow-50'
                  : 'bg-red-50'
                : 'bg-green-50'
            "
          >
            <p
              class="text-sm font-medium"
              :class="
                hasDiscrepancy
                  ? cashDifference > 0
                    ? 'text-yellow-700'
                    : 'text-red-700'
                  : 'text-green-700'
              "
            >
              {{
                hasDiscrepancy
                  ? `Diferencia: ${cashDifference > 0 ? "+" : ""}$${cashDifference.toFixed(2)}`
                  : "Caja cuadrada"
              }}
            </p>
          </div>
        </div>

        <div
          v-if="daySummary.topProducts.length > 0"
          class="rounded-xl bg-white p-5 shadow-sm"
        >
          <h3 class="mb-3 text-sm font-semibold text-gray-700">
            Top productos
          </h3>
          <div class="space-y-2">
            <div
              v-for="(p, i) in daySummary.topProducts"
              :key="p.name"
              class="flex items-center justify-between text-sm"
            >
              <span class="text-gray-600"
                >{{ i + 1 }}. {{ p.name }} (x{{ p.qty }})</span
              >
              <span class="font-medium text-gray-900"
                >${{ p.total.toFixed(2) }}</span
              >
            </div>
          </div>
        </div>

        <textarea
          v-model="notes"
          rows="2"
          placeholder="Notas del cierre (opcional)"
          class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-nova-primary focus:outline-none"
        />

        <!-- Submit error -->
        <p v-if="submitError" class="text-sm text-red-500">
          {{ submitError }}
        </p>

        <div class="flex gap-3">
          <button
            class="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700"
            @click="step = 'count'"
          >
            Volver
          </button>
          <button
            class="flex-1 rounded-xl bg-nova-primary py-3 text-sm font-medium text-white disabled:opacity-50"
            :disabled="isSubmitting"
            @click="confirmClose"
          >
            {{ isSubmitting ? "Cerrando..." : "Confirmar cierre" }}
          </button>
        </div>
      </div>

      <!-- Step 3: Done -->
      <div v-else class="py-12 text-center">
        <div class="mb-4 text-5xl">✓</div>
        <h2 class="text-2xl font-bold text-gray-900">Dia cerrado</h2>
        <p class="mt-2 text-gray-500">
          ${{ daySummary.totalSalesUsd.toFixed(2) }} en
          {{ daySummary.totalSalesCount }} ventas
        </p>
        <button
          class="mt-8 inline-block rounded-xl bg-nova-primary px-8 py-3 font-medium text-white"
          @click="router.push('/')"
        >
          Ir al dashboard
        </button>
      </div>
    </template>
  </div>
</template>
