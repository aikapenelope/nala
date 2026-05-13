<script setup lang="ts">
/**
 * Consolidated settings page.
 *
 * Three collapsible sections:
 * - Negocio: accountant email, WhatsApp number
 * - Tasa de cambio: BCV rate, EUR rate, official BCV fetch
 * - Tienda online: link to /settings/store (full config page)
 *
 * Connected to:
 * - GET /api/settings, PATCH /api/settings
 * - GET /api/exchange-rate, POST /api/exchange-rate, GET /api/exchange-rate/bcv
 */

import {
  Store,
  ArrowLeftRight,
  ShoppingBag,
  ChevronDown,
  Mail,
  Phone,
  Save,
  RefreshCw,
} from "lucide-vue-next";

const { $api } = useApi();
const { user } = useNovaAuth();
const { toast } = useToast();

// ============================================================
// Section expand state
// ============================================================

const businessExpanded = ref(true);
const rateExpanded = ref(false);

// ============================================================
// Business settings
// ============================================================

const businessLoading = ref(true);
const accountantEmail = ref("");
const whatsappNumber = ref("");
const originalEmail = ref("");
const originalWhatsapp = ref("");
const businessSaving = ref(false);
const businessSaveError = ref("");

const businessHasChanges = computed(
  () =>
    accountantEmail.value !== originalEmail.value ||
    whatsappNumber.value !== originalWhatsapp.value,
);

async function fetchBusinessSettings() {
  businessLoading.value = true;
  try {
    const result = await $api<{
      settings: {
        accountantEmail: string | null;
        whatsappNumber: string | null;
      };
    }>("/api/settings");
    accountantEmail.value = result.settings.accountantEmail ?? "";
    whatsappNumber.value = result.settings.whatsappNumber ?? "";
    originalEmail.value = accountantEmail.value;
    originalWhatsapp.value = whatsappNumber.value;
  } catch {
    /* empty state */
  } finally {
    businessLoading.value = false;
  }
}

async function saveBusinessSettings() {
  if (!businessHasChanges.value) return;
  businessSaving.value = true;
  businessSaveError.value = "";
  try {
    const body: Record<string, string | null> = {};
    if (accountantEmail.value !== originalEmail.value) {
      body.accountantEmail = accountantEmail.value || null;
    }
    if (whatsappNumber.value !== originalWhatsapp.value) {
      body.whatsappNumber = whatsappNumber.value || null;
    }
    const result = await $api<{
      settings: { accountantEmail: string | null; whatsappNumber: string | null };
    }>("/api/settings", { method: "PATCH", body });
    accountantEmail.value = result.settings.accountantEmail ?? "";
    whatsappNumber.value = result.settings.whatsappNumber ?? "";
    originalEmail.value = accountantEmail.value;
    originalWhatsapp.value = whatsappNumber.value;
    toast("Configuracion guardada");
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    businessSaveError.value = fetchError.data?.error ?? "Error al guardar";
  } finally {
    businessSaving.value = false;
  }
}

// ============================================================
// Exchange rate settings
// ============================================================

const rateLoading = ref(true);
const rateInputUsd = ref("");
const rateInputEur = ref("");
const rateSaving = ref(false);
const rateSaveError = ref("");

const bcvOfficial = ref<{ usd: number; eur: number; date: string } | null>(null);
const loadingBcv = ref(false);

async function fetchRate() {
  rateLoading.value = true;
  try {
    const result = await $api<{ rateBcv: number; rateEur: number | null }>("/api/exchange-rate");
    rateInputUsd.value = result.rateBcv.toFixed(2);
    rateInputEur.value = result.rateEur?.toFixed(2) ?? "";
  } catch {
    /* no rate set yet */
  } finally {
    rateLoading.value = false;
  }
}

async function fetchBcvOfficial() {
  loadingBcv.value = true;
  try {
    const result = await $api<{ rateBcv: number; rateEur: number; date: string }>("/api/exchange-rate/bcv");
    bcvOfficial.value = { usd: result.rateBcv, eur: result.rateEur, date: result.date };
  } catch {
    /* BCV unavailable */
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
    rateSaveError.value = "La tasa del dolar debe ser mayor a 0";
    return;
  }
  rateSaving.value = true;
  rateSaveError.value = "";
  try {
    await $api("/api/exchange-rate", { method: "POST", body: { rateBcv: usd, rateEur: eur } });
    toast("Tasa guardada");
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    rateSaveError.value = fetchError.data?.error ?? "Error guardando tasa";
  } finally {
    rateSaving.value = false;
  }
}

// ============================================================
// Init
// ============================================================

onMounted(() => {
  fetchBusinessSettings();
  fetchRate();
  fetchBcvOfficial();
});
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="mb-1 text-2xl font-extrabold tracking-tight text-gradient">
      Configuracion
    </h1>
    <p class="mb-6 text-sm font-medium text-gray-500">
      {{ user?.name ?? "Admin" }}
    </p>

    <div class="space-y-3">
      <!-- ============================================================ -->
      <!-- Section: Negocio -->
      <!-- ============================================================ -->
      <div class="overflow-hidden rounded-[20px] border border-white/80 bg-gradient-to-br from-[#EEF7FD] to-[#CAE8F8]">
        <button
          class="flex w-full items-center gap-4 p-4 text-left"
          @click="businessExpanded = !businessExpanded"
        >
          <div class="dark-pill flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px]">
            <Store :size="18" class="text-white" />
          </div>
          <div class="flex-1">
            <p class="text-sm font-bold text-gray-800">Negocio</p>
            <p class="text-xs font-medium text-gray-600/70">Email del contador, WhatsApp</p>
          </div>
          <ChevronDown :size="16" class="text-gray-400 transition-transform" :class="businessExpanded ? 'rotate-180' : ''" />
        </button>

        <div v-if="businessExpanded" class="border-t border-white/50 bg-white/40 px-5 pb-5 pt-4">
          <div v-if="businessLoading" class="py-4 text-center text-sm text-gray-400">Cargando...</div>
          <div v-else class="space-y-4">
            <div>
              <div class="mb-2 flex items-center gap-2">
                <Mail :size="14" class="text-blue-600" />
                <label class="text-sm font-medium text-gray-700">Email del contador</label>
              </div>
              <input
                v-model="accountantEmail"
                type="email"
                placeholder="contador@ejemplo.com"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
              >
            </div>
            <div>
              <div class="mb-2 flex items-center gap-2">
                <Phone :size="14" class="text-green-600" />
                <label class="text-sm font-medium text-gray-700">WhatsApp del negocio</label>
              </div>
              <input
                v-model="whatsappNumber"
                type="tel"
                placeholder="+58 412 1234567"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
              >
            </div>
            <button
              class="flex w-full items-center justify-center gap-2 rounded-lg bg-nova-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
              :disabled="!businessHasChanges || businessSaving"
              @click="saveBusinessSettings"
            >
              <Save :size="14" />
              {{ businessSaving ? "Guardando..." : "Guardar" }}
            </button>
            <p v-if="businessSaveError" class="text-center text-xs text-red-500">{{ businessSaveError }}</p>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Section: Tasa de cambio -->
      <!-- ============================================================ -->
      <div class="overflow-hidden rounded-[20px] border border-white/80 bg-gradient-to-br from-[#F0FDF4] to-[#BBF7D0]">
        <button
          class="flex w-full items-center gap-4 p-4 text-left"
          @click="rateExpanded = !rateExpanded"
        >
          <div class="dark-pill flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px]">
            <ArrowLeftRight :size="18" class="text-white" />
          </div>
          <div class="flex-1">
            <p class="text-sm font-bold text-gray-800">Tasa de cambio</p>
            <p class="text-xs font-medium text-gray-600/70">BCV y EUR</p>
          </div>
          <ChevronDown :size="16" class="text-gray-400 transition-transform" :class="rateExpanded ? 'rotate-180' : ''" />
        </button>

        <div v-if="rateExpanded" class="border-t border-white/50 bg-white/40 px-5 pb-5 pt-4">
          <div v-if="rateLoading" class="py-4 text-center text-sm text-gray-400">Cargando...</div>
          <div v-else class="space-y-4">
            <!-- Official BCV -->
            <div v-if="bcvOfficial" class="rounded-lg bg-white/60 p-3">
              <div class="flex items-center justify-between">
                <p class="text-xs font-bold text-gray-500">Tasa oficial BCV</p>
                <button class="flex items-center gap-1 text-xs text-nova-primary" :disabled="loadingBcv" @click="fetchBcvOfficial">
                  <RefreshCw :size="10" :class="{ 'animate-spin': loadingBcv }" />
                  Actualizar
                </button>
              </div>
              <div class="mt-2 flex gap-4">
                <div>
                  <p class="text-lg font-bold text-gray-900">Bs.{{ bcvOfficial.usd.toFixed(2) }}</p>
                  <p class="text-[10px] text-gray-500">USD</p>
                </div>
                <div>
                  <p class="text-lg font-bold text-gray-900">Bs.{{ bcvOfficial.eur.toFixed(2) }}</p>
                  <p class="text-[10px] text-gray-500">EUR</p>
                </div>
              </div>
              <button class="mt-2 w-full rounded-lg bg-nova-primary/10 py-1.5 text-xs font-semibold text-nova-primary" @click="useBcvRate">
                Usar tasa oficial
              </button>
            </div>

            <!-- Manual rate inputs -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-sm text-gray-600">Dolar (USD)</label>
                <input
                  v-model="rateInputUsd"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="86.48"
                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
                >
              </div>
              <div>
                <label class="mb-1 block text-sm text-gray-600">Euro (EUR)</label>
                <input
                  v-model="rateInputEur"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="96.20"
                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
                >
              </div>
            </div>
            <button
              class="w-full rounded-lg bg-nova-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
              :disabled="rateSaving"
              @click="saveRate"
            >
              {{ rateSaving ? "Guardando..." : "Guardar tasa" }}
            </button>
            <p v-if="rateSaveError" class="text-center text-xs text-red-500">{{ rateSaveError }}</p>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Section: Tienda online (link to full config) -->
      <!-- ============================================================ -->
      <NuxtLink
        to="/settings/store"
        class="card-lift relative flex items-center gap-4 overflow-hidden rounded-[20px] border border-white/80 bg-gradient-to-br from-[#F0FDF4] to-[#D1FAE5] p-4"
      >
        <div class="absolute -top-3 -right-3 h-12 w-12 rounded-full bg-white/30 blur-lg" />
        <div class="relative z-10 dark-pill flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px]">
          <ShoppingBag :size="18" class="text-white" />
        </div>
        <div class="relative z-10 flex-1">
          <p class="text-sm font-bold text-gray-800">Tienda online</p>
          <p class="text-xs font-medium text-gray-600/70">Metodos de pago, delivery, activar tienda</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
