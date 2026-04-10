<script setup lang="ts">
/**
 * Day close - end-of-day cash reconciliation.
 * 3 steps: count cash, review comparison, confirm.
 */

definePageMeta({ middleware: ["admin-only"] });

type CloseStep = "count" | "review" | "done";
const step = ref<CloseStep>("count");
const cashCounted = ref<number | null>(null);
const notes = ref("");
const isSubmitting = ref(false);

const daySummary = ref({
  totalSalesUsd: 420.0,
  totalSalesCount: 23,
  totalVoidsCount: 1,
  cashExpected: 285.0,
  salesByMethod: [
    { method: "Efectivo", amount: 285.0, count: 15 },
    { method: "Pago Móvil", amount: 85.0, count: 5 },
    { method: "Binance", amount: 30.0, count: 2 },
    { method: "Fiado", amount: 20.0, count: 1 },
  ],
  topProducts: [
    { name: "Pan Campesino", quantity: 85, total: 127.5 },
    { name: "Café con Leche", quantity: 42, total: 42.0 },
    { name: "Queso Blanco", quantity: 15, total: 45.0 },
  ],
});

const cashDifference = computed(() => {
  if (cashCounted.value === null) return 0;
  return Math.round((cashCounted.value - daySummary.value.cashExpected) * 100) / 100;
});

const hasDiscrepancy = computed(() => Math.abs(cashDifference.value) > 0.5);

function proceedToReview() {
  if (cashCounted.value === null || cashCounted.value < 0) return;
  step.value = "review";
}

async function confirmClose() {
  isSubmitting.value = true;
  try {
    await new Promise((resolve) => setTimeout(resolve, 800));
    step.value = "done";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg">
    <h1 class="mb-6 text-xl font-bold text-gray-900">Cierre del día</h1>

    <!-- Step 1: Count -->
    <div v-if="step === 'count'" class="space-y-6">
      <div class="rounded-xl bg-white p-6 shadow-sm">
        <h2 class="mb-1 text-sm font-semibold text-gray-700">Resumen de hoy</h2>
        <div class="mt-4 grid grid-cols-3 gap-4 text-center">
          <div><p class="text-2xl font-bold text-gray-900">${{ daySummary.totalSalesUsd.toFixed(0) }}</p><p class="text-xs text-gray-500">Ventas</p></div>
          <div><p class="text-2xl font-bold text-gray-900">{{ daySummary.totalSalesCount }}</p><p class="text-xs text-gray-500">Transacciones</p></div>
          <div><p class="text-2xl font-bold text-gray-900">{{ daySummary.totalVoidsCount }}</p><p class="text-xs text-gray-500">Anulaciones</p></div>
        </div>
        <div class="mt-4 space-y-2">
          <div v-for="m in daySummary.salesByMethod" :key="m.method" class="flex items-center justify-between text-sm">
            <span class="text-gray-600">{{ m.method }} ({{ m.count }})</span>
            <span class="font-medium text-gray-900">${{ m.amount.toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <div class="rounded-xl bg-white p-6 shadow-sm">
        <h2 class="mb-4 text-sm font-semibold text-gray-700">¿Cuánto efectivo hay en caja?</h2>
        <div class="flex items-center gap-2">
          <span class="text-2xl text-gray-400">$</span>
          <input v-model.number="cashCounted" type="number" step="0.01" min="0" placeholder="0.00" class="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-2xl font-bold focus:border-nova-primary focus:outline-none" autofocus />
        </div>
        <p class="mt-2 text-xs text-gray-400">Esperado: ${{ daySummary.cashExpected.toFixed(2) }}</p>
      </div>

      <button class="w-full rounded-xl bg-nova-primary py-3 font-medium text-white disabled:opacity-50" :disabled="cashCounted === null || cashCounted < 0" @click="proceedToReview">Revisar cierre</button>
    </div>

    <!-- Step 2: Review -->
    <div v-else-if="step === 'review'" class="space-y-6">
      <div class="rounded-xl bg-white p-6 shadow-sm">
        <div class="grid grid-cols-2 gap-4 text-center">
          <div><p class="text-sm text-gray-500">Contado</p><p class="text-2xl font-bold text-gray-900">${{ (cashCounted ?? 0).toFixed(2) }}</p></div>
          <div><p class="text-sm text-gray-500">Esperado</p><p class="text-2xl font-bold text-gray-900">${{ daySummary.cashExpected.toFixed(2) }}</p></div>
        </div>
        <div class="mt-4 rounded-lg p-3 text-center" :class="hasDiscrepancy ? (cashDifference > 0 ? 'bg-yellow-50' : 'bg-red-50') : 'bg-green-50'">
          <p class="text-sm font-medium" :class="hasDiscrepancy ? (cashDifference > 0 ? 'text-yellow-700' : 'text-red-700') : 'text-green-700'">
            {{ hasDiscrepancy ? `Diferencia: ${cashDifference > 0 ? "+" : ""}$${cashDifference.toFixed(2)}` : "Caja cuadrada" }}
          </p>
        </div>
      </div>

      <div class="rounded-xl bg-white p-5 shadow-sm">
        <h3 class="mb-3 text-sm font-semibold text-gray-700">Top productos</h3>
        <div class="space-y-2">
          <div v-for="(p, i) in daySummary.topProducts" :key="p.name" class="flex items-center justify-between text-sm">
            <span class="text-gray-600">{{ i + 1 }}. {{ p.name }} (x{{ p.quantity }})</span>
            <span class="font-medium text-gray-900">${{ p.total.toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <textarea v-model="notes" rows="2" placeholder="Notas del cierre (opcional)" class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-nova-primary focus:outline-none" />

      <div class="flex gap-3">
        <button class="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700" @click="step = 'count'">Volver</button>
        <button class="flex-1 rounded-xl bg-nova-primary py-3 text-sm font-medium text-white disabled:opacity-50" :disabled="isSubmitting" @click="confirmClose">{{ isSubmitting ? "Cerrando..." : "Confirmar cierre" }}</button>
      </div>
    </div>

    <!-- Step 3: Done -->
    <div v-else class="py-12 text-center">
      <div class="mb-4 text-5xl">✓</div>
      <h2 class="text-2xl font-bold text-gray-900">Día cerrado</h2>
      <p class="mt-2 text-gray-500">${{ daySummary.totalSalesUsd.toFixed(2) }} en {{ daySummary.totalSalesCount }} ventas</p>
      <NuxtLink to="/" class="mt-8 inline-block rounded-xl bg-nova-primary px-8 py-3 font-medium text-white">Ir al dashboard</NuxtLink>
    </div>
  </div>
</template>
