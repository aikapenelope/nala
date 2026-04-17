<script setup lang="ts">
/**
 * Business settings page (owner only).
 *
 * Allows the owner to view and update:
 * - Accountant email (for report delivery via Resend)
 * - WhatsApp number (for "Order via WhatsApp" on the public catalog)
 *
 * Connected to:
 * - GET  /api/settings
 * - PATCH /api/settings
 */

import { Mail, Phone, Save, ArrowLeft } from "lucide-vue-next";

definePageMeta({ middleware: ["admin-only"] });

const { $api } = useApi();

/** Form state. */
const accountantEmail = ref("");
const whatsappNumber = ref("");

const isLoading = ref(true);
const loadError = ref("");
const isSaving = ref(false);
const saveSuccess = ref(false);
const saveError = ref("");

/** Track original values to detect changes. */
const originalEmail = ref("");
const originalWhatsapp = ref("");

const hasChanges = computed(
  () =>
    accountantEmail.value !== originalEmail.value ||
    whatsappNumber.value !== originalWhatsapp.value,
);

/** Fetch current settings from the API. */
async function fetchSettings() {
  isLoading.value = true;
  loadError.value = "";
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
    loadError.value = "Error cargando configuracion";
  } finally {
    isLoading.value = false;
  }
}

/** Save updated settings. */
async function saveSettings() {
  if (!hasChanges.value) return;

  isSaving.value = true;
  saveError.value = "";
  saveSuccess.value = false;

  try {
    const body: Record<string, string | null> = {};

    if (accountantEmail.value !== originalEmail.value) {
      body.accountantEmail = accountantEmail.value || null;
    }
    if (whatsappNumber.value !== originalWhatsapp.value) {
      body.whatsappNumber = whatsappNumber.value || null;
    }

    const result = await $api<{
      settings: {
        accountantEmail: string | null;
        whatsappNumber: string | null;
      };
    }>("/api/settings", {
      method: "PATCH",
      body,
    });

    accountantEmail.value = result.settings.accountantEmail ?? "";
    whatsappNumber.value = result.settings.whatsappNumber ?? "";
    originalEmail.value = accountantEmail.value;
    originalWhatsapp.value = whatsappNumber.value;

    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 3000);
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    saveError.value =
      fetchError.data?.error ?? "Error al guardar configuracion";
  } finally {
    isSaving.value = false;
  }
}

onMounted(fetchSettings);
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <!-- Header -->
    <div class="mb-6">
      <NuxtLink
        to="/settings"
        class="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft :size="16" />
        Configuracion
      </NuxtLink>
      <h1 class="text-xl font-bold text-gray-900">Negocio</h1>
      <p class="text-sm text-gray-500">
        Informacion de contacto y configuracion general
      </p>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando configuracion...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
      <button
        class="mt-2 block w-full text-xs font-medium text-red-700 underline"
        @click="fetchSettings"
      >
        Reintentar
      </button>
    </div>

    <!-- Form -->
    <div v-else class="space-y-6">
      <!-- Accountant email -->
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <div class="mb-3 flex items-center gap-3">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50"
          >
            <Mail :size="18" class="text-blue-600" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-900">
              Email del contador
            </p>
            <p class="text-xs text-gray-500">
              Recibe reportes financieros por correo
            </p>
          </div>
        </div>
        <input
          v-model="accountantEmail"
          type="email"
          placeholder="contador@ejemplo.com"
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
        />
      </div>

      <!-- WhatsApp number -->
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <div class="mb-3 flex items-center gap-3">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50"
          >
            <Phone :size="18" class="text-green-600" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-900">
              WhatsApp del negocio
            </p>
            <p class="text-xs text-gray-500">
              Aparece en el catalogo publico para pedidos
            </p>
          </div>
        </div>
        <input
          v-model="whatsappNumber"
          type="tel"
          placeholder="+58 412 1234567"
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
        />
      </div>

      <!-- Save button -->
      <div>
        <button
          class="flex w-full items-center justify-center gap-2 rounded-lg bg-nova-primary py-3 text-sm font-medium text-white disabled:opacity-50"
          :disabled="!hasChanges || isSaving"
          @click="saveSettings"
        >
          <Save :size="16" />
          {{ isSaving ? "Guardando..." : "Guardar cambios" }}
        </button>

        <!-- Success message -->
        <p
          v-if="saveSuccess"
          class="mt-3 text-center text-sm font-medium text-green-600"
        >
          Configuracion guardada
        </p>

        <!-- Error message -->
        <p v-if="saveError" class="mt-3 text-center text-sm text-red-500">
          {{ saveError }}
        </p>
      </div>
    </div>
  </div>
</template>
