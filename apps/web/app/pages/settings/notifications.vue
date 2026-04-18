<script setup lang="ts">
/**
 * Notification preferences settings page.
 *
 * Connected to:
 * - GET /api/notification-preferences
 * - PATCH /api/notification-preferences
 */

import { ArrowLeft } from "lucide-vue-next";

definePageMeta({ middleware: ["admin-only"] });

const { $api } = useApi();

const isLoading = ref(true);
const isSaving = ref(false);
const saveSuccess = ref(false);
const saveError = ref("");

const prefs = reactive({
  dailySummaryEmail: false,
  lowStockAlert: true,
  expirationAlert: true,
  debtAlert: true,
});

const original = reactive({ ...prefs });

const hasChanges = computed(
  () =>
    prefs.dailySummaryEmail !== original.dailySummaryEmail ||
    prefs.lowStockAlert !== original.lowStockAlert ||
    prefs.expirationAlert !== original.expirationAlert ||
    prefs.debtAlert !== original.debtAlert,
);

async function fetchPrefs() {
  isLoading.value = true;
  try {
    const result = await $api<{
      preferences: {
        dailySummaryEmail: boolean;
        lowStockAlert: boolean;
        expirationAlert: boolean;
        debtAlert: boolean;
      };
    }>("/api/notification-preferences");
    Object.assign(prefs, result.preferences);
    Object.assign(original, result.preferences);
  } catch {
    // Use defaults
  } finally {
    isLoading.value = false;
  }
}

async function savePrefs() {
  if (!hasChanges.value) return;
  isSaving.value = true;
  saveError.value = "";
  saveSuccess.value = false;
  try {
    await $api("/api/notification-preferences", {
      method: "PATCH",
      body: { ...prefs },
    });
    Object.assign(original, { ...prefs });
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 3000);
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    saveError.value = fetchError.data?.error ?? "Error al guardar";
  } finally {
    isSaving.value = false;
  }
}

onMounted(fetchPrefs);

const toggles: Array<{
  key: keyof typeof prefs;
  label: string;
  description: string;
}> = [
  {
    key: "dailySummaryEmail",
    label: "Resumen diario por email",
    description: "Recibe un resumen de ventas y alertas cada manana",
  },
  {
    key: "lowStockAlert",
    label: "Alerta de stock bajo",
    description: "Notifica cuando un producto llega al nivel critico",
  },
  {
    key: "expirationAlert",
    label: "Alerta de vencimiento",
    description: "Notifica 30 dias antes de que un producto venza",
  },
  {
    key: "debtAlert",
    label: "Alerta de deudas",
    description: "Notifica cuando un cliente tiene deuda vencida",
  },
];
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
      <h1 class="text-xl font-bold text-gray-900">Notificaciones</h1>
      <p class="text-sm text-gray-500">
        Configura que alertas quieres recibir
      </p>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
    </div>

    <template v-else>
      <div class="space-y-3">
        <div
          v-for="toggle in toggles"
          :key="toggle.key"
          class="flex items-center justify-between rounded-xl bg-white p-5 shadow-sm"
        >
          <div>
            <p class="text-sm font-medium text-gray-900">{{ toggle.label }}</p>
            <p class="text-xs text-gray-500">{{ toggle.description }}</p>
          </div>
          <label class="relative inline-flex cursor-pointer items-center">
            <input
              v-model="prefs[toggle.key]"
              type="checkbox"
              class="peer sr-only"
            >
            <div
              class="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-nova-primary peer-checked:after:translate-x-full"
            />
          </label>
        </div>
      </div>

      <button
        class="mt-6 w-full rounded-lg bg-nova-primary py-3 text-sm font-medium text-white disabled:opacity-50"
        :disabled="!hasChanges || isSaving"
        @click="savePrefs"
      >
        {{ isSaving ? "Guardando..." : "Guardar preferencias" }}
      </button>

      <p
        v-if="saveSuccess"
        class="mt-3 text-center text-sm font-medium text-green-600"
      >
        Preferencias guardadas
      </p>
      <p v-if="saveError" class="mt-3 text-center text-sm text-red-500">
        {{ saveError }}
      </p>
    </template>
  </div>
</template>
