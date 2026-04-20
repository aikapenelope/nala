<script setup lang="ts">
/**
 * Cash opening page - declare starting cash.
 *
 * Connected to:
 * - GET /api/cash-opening/latest
 * - POST /api/cash-opening
 */

import { ArrowLeft } from "lucide-vue-next";

definePageMeta({ middleware: ["admin-only"] });

const router = useRouter();
const { $api } = useApi();

const isLoading = ref(true);
const alreadyOpened = ref(false);
const openingAmount = ref<number | null>(null);

const cashAmount = ref(0);
const notes = ref("");
const isSubmitting = ref(false);
const submitError = ref("");

onMounted(async () => {
  try {
    const result = await $api<{ opening: { cashAmount: string } | null }>(
      "/api/cash-opening/latest",
    );
    if (result.opening) {
      alreadyOpened.value = true;
      openingAmount.value = Number(result.opening.cashAmount);
    }
  } catch {
    // No opening yet
  } finally {
    isLoading.value = false;
  }
});

async function submitOpening() {
  if (cashAmount.value < 0) {
    submitError.value = "El monto no puede ser negativo";
    return;
  }
  isSubmitting.value = true;
  submitError.value = "";
  try {
    await $api("/api/cash-opening", {
      method: "POST",
      body: {
        cashAmount: cashAmount.value,
        notes: notes.value || undefined,
      },
    });
    router.push("/");
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    submitError.value = fetchError.data?.error ?? "Error registrando apertura";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-md">
    <div class="mb-6">
      <NuxtLink
        to="/"
        class="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft :size="16" />
        Inicio
      </NuxtLink>
      <h1 class="text-xl font-bold text-gray-900">Apertura de caja</h1>
      <p class="text-sm text-gray-500">
        Declara el efectivo al inicio del dia
      </p>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
    </div>

    <div
      v-else-if="alreadyOpened"
      class="rounded-xl bg-green-50 p-6 text-center"
    >
      <p class="text-lg font-bold text-green-700">Caja ya abierta hoy</p>
      <p class="mt-2 text-sm text-green-600">
        Monto declarado: ${{ openingAmount?.toFixed(2) }}
      </p>
      <NuxtLink
        to="/"
        class="mt-4 inline-block rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white"
      >
        Volver al inicio
      </NuxtLink>
    </div>

    <div v-else class="space-y-4">
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <label class="mb-2 block text-sm font-medium text-gray-700">
          Efectivo en caja ($)
        </label>
        <input
          v-model.number="cashAmount"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          class="w-full rounded-lg border border-gray-300 px-4 py-3 text-2xl font-bold text-gray-900 focus:border-nova-primary focus:outline-none"
          autofocus
        >
      </div>

      <div class="rounded-xl bg-white p-5 shadow-sm">
        <label class="mb-2 block text-sm font-medium text-gray-700">
          Notas (opcional)
        </label>
        <input
          v-model="notes"
          type="text"
          placeholder="Ej: Incluye vuelto del dia anterior"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
        >
      </div>

      <p v-if="submitError" class="text-sm text-red-500">{{ submitError }}</p>

      <button
        class="w-full rounded-xl bg-nova-primary py-3 font-medium text-white disabled:opacity-50"
        :disabled="isSubmitting"
        @click="submitOpening"
      >
        {{ isSubmitting ? "Registrando..." : "Abrir caja" }}
      </button>
    </div>
  </div>
</template>
