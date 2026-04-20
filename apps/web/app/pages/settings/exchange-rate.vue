<script setup lang="ts">
/**
 * Exchange rate settings page.
 *
 * Connected to:
 * - GET /api/exchange-rate
 * - GET /api/exchange-rate/bcv
 * - POST /api/exchange-rate
 */

import { ArrowLeft, RefreshCw } from "lucide-vue-next";

definePageMeta({ middleware: ["admin-only"] });

const { $api } = useApi();

const isLoading = ref(true);
const rateBcv = ref(0);
const rateEur = ref<number | null>(null);
const rateInputUsd = ref("");
const rateInputEur = ref("");
const isSaving = ref(false);
const saveError = ref("");
const saveSuccess = ref(false);

/** Official BCV rate for reference. */
const bcvOfficial = ref<{ usd: number; eur: number; date: string } | null>(
  null,
);
const loadingBcv = ref(false);

async function fetchRate() {
  isLoading.value = true;
  try {
    const result = await $api<{ rateBcv: number; rateEur: number | null }>(
      "/api/exchange-rate",
    );
    rateBcv.value = result.rateBcv;
    rateEur.value = result.rateEur;
    rateInputUsd.value = result.rateBcv.toFixed(2);
    rateInputEur.value = result.rateEur?.toFixed(2) ?? "";
  } catch {
    // No rate set yet
  } finally {
    isLoading.value = false;
  }
}

async function fetchBcvOfficial() {
  loadingBcv.value = true;
  try {
    const result = await $api<{
      rateBcv: number;
      rateEur: number;
      date: string;
    }>("/api/exchange-rate/bcv");
    bcvOfficial.value = {
      usd: result.rateBcv,
      eur: result.rateEur,
      date: result.date,
    };
  } catch {
    // BCV unavailable
  } finally {
    loadingBcv.value = false;
  }
}

function useBcvRate() {
  if (bcvOfficial.value) {
    rateInputUsd.value = bcvOfficial.value.usd.toFixed(2);
    rateInputEur.value = bcvOfficial.value.eur.toFixed(2);
  }
}

async function saveRate() {
  const usd = Number(rateInputUsd.value);
  const eur = rateInputEur.value ? Number(rateInputEur.value) : undefined;
  if (!usd || usd <= 0) {
    saveError.value = "La tasa del dolar debe ser mayor a 0";
    return;
  }
  isSaving.value = true;
  saveError.value = "";
  saveSuccess.value = false;
  try {
    const result = await $api<{ rateBcv: number; rateEur: number | null }>(
      "/api/exchange-rate",
      { method: "POST", body: { rateBcv: usd, rateEur: eur } },
    );
    rateBcv.value = result.rateBcv;
    rateEur.value = result.rateEur;
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 3000);
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    saveError.value = fetchError.data?.error ?? "Error guardando tasa";
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  fetchRate();
  fetchBcvOfficial();
});
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-6">
      <NuxtLink
        to="/settings"
        class="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft :size="16" />
        Configuracion
      </NuxtLink>
      <h1 class="text-xl font-bold text-gray-900">Tasa de cambio</h1>
      <p class="text-sm text-gray-500">
        Configura la tasa BCV para conversion USD/Bs
      </p>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
    </div>

    <template v-else>
      <!-- Official BCV rate -->
      <div class="mb-6 rounded-xl bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-700">Tasa oficial BCV</h2>
          <button
            class="flex items-center gap-1 text-xs text-nova-primary"
            :disabled="loadingBcv"
            @click="fetchBcvOfficial"
          >
            <RefreshCw :size="12" :class="{ 'animate-spin': loadingBcv }" />
            Actualizar
          </button>
        </div>
        <div v-if="bcvOfficial" class="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p class="text-2xl font-bold text-gray-900">
              Bs.{{ bcvOfficial.usd.toFixed(2) }}
            </p>
            <p class="text-xs text-gray-500">Dolar USD</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">
              Bs.{{ bcvOfficial.eur.toFixed(2) }}
            </p>
            <p class="text-xs text-gray-500">Euro EUR</p>
          </div>
          <button
            class="col-span-2 rounded-lg bg-nova-primary/10 py-2 text-xs font-semibold text-nova-primary"
            @click="useBcvRate"
          >
            Usar tasa oficial
          </button>
        </div>
        <p v-else class="mt-3 text-sm text-gray-400">
          {{ loadingBcv ? "Consultando BCV..." : "No disponible" }}
        </p>
      </div>

      <!-- Manual rate -->
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <h2 class="mb-4 text-sm font-semibold text-gray-700">
          Tasa de tu negocio
        </h2>
        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-sm text-gray-600">Dolar (USD)</label>
            <input
              v-model="rateInputUsd"
              type="number"
              step="0.01"
              min="0"
              placeholder="86.48"
              class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
            >
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600">
              Euro (EUR) - opcional
            </label>
            <input
              v-model="rateInputEur"
              type="number"
              step="0.01"
              min="0"
              placeholder="96.20"
              class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
            >
          </div>
        </div>
        <p v-if="saveError" class="mt-3 text-sm text-red-500">
          {{ saveError }}
        </p>
        <p
          v-if="saveSuccess"
          class="mt-3 text-sm font-medium text-green-600"
        >
          Tasa guardada
        </p>
        <button
          class="mt-4 w-full rounded-lg bg-nova-primary py-3 text-sm font-medium text-white disabled:opacity-50"
          :disabled="isSaving"
          @click="saveRate"
        >
          {{ isSaving ? "Guardando..." : "Guardar tasa" }}
        </button>
      </div>
    </template>
  </div>
</template>
