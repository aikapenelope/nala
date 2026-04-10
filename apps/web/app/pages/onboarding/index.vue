<script setup lang="ts">
/**
 * Onboarding flow after Clerk registration.
 *
 * Step 1: "What type of business do you have?" (visual selector)
 * Step 2: Business name
 * Step 3: Done - Nova pre-configures categories and accounts
 *
 * Pattern from Square: 5 steps, 5 minutes, no support call needed.
 */

import type { BusinessType } from "@nova/shared";

const step = ref(1);
const businessType = ref<BusinessType | null>(null);
const businessName = ref("");
const isSubmitting = ref(false);
const error = ref("");

/** Business type options with visual labels. */
const businessTypes: Array<{ value: BusinessType; label: string; icon: string }> = [
  { value: "ferreteria", label: "Ferretería", icon: "wrench" },
  { value: "bodega", label: "Bodega", icon: "store" },
  { value: "ropa", label: "Tienda de ropa", icon: "shirt" },
  { value: "autopartes", label: "Autopartes", icon: "car" },
  { value: "peluqueria", label: "Peluquería", icon: "scissors" },
  { value: "farmacia", label: "Farmacia", icon: "pill" },
  { value: "electronica", label: "Electrónica", icon: "monitor" },
  { value: "libreria", label: "Librería", icon: "book" },
  { value: "cosmeticos", label: "Cosméticos", icon: "sparkles" },
  { value: "distribuidora", label: "Distribuidora", icon: "truck" },
  { value: "otro", label: "Otro", icon: "building" },
];

function selectType(type: BusinessType) {
  businessType.value = type;
  step.value = 2;
}

async function createBusiness() {
  if (!businessType.value || !businessName.value.trim()) return;

  isSubmitting.value = true;
  error.value = "";

  try {
    // TODO: Call API to create business + owner user
    // await $fetch('/api/onboarding', {
    //   method: 'POST',
    //   body: {
    //     businessType: businessType.value,
    //     businessName: businessName.value.trim(),
    //   }
    // });

    step.value = 3;
  } catch {
    error.value = "Error al crear el negocio. Intenta de nuevo.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-lg">
      <!-- Step 1: Business type -->
      <div v-if="step === 1" class="text-center">
        <h1 class="text-2xl font-bold text-gray-900">
          Bienvenido a Nova
        </h1>
        <p class="mt-2 text-gray-500">
          ¿Qué tipo de negocio tienes?
        </p>

        <div class="mt-8 grid grid-cols-3 gap-3">
          <button
            v-for="bt in businessTypes"
            :key="bt.value"
            class="flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors"
            :class="
              businessType === bt.value
                ? 'border-nova-primary bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            "
            @click="selectType(bt.value)"
          >
            <span class="text-2xl">{{ bt.icon }}</span>
            <span class="text-xs font-medium text-gray-700">{{ bt.label }}</span>
          </button>
        </div>
      </div>

      <!-- Step 2: Business name -->
      <div v-else-if="step === 2" class="text-center">
        <h1 class="text-2xl font-bold text-gray-900">
          ¿Cómo se llama tu negocio?
        </h1>
        <p class="mt-2 text-gray-500">
          Este nombre aparecerá en recibos y reportes
        </p>

        <div class="mt-8">
          <input
            v-model="businessName"
            type="text"
            placeholder="Ej: Bodega Don Pedro"
            class="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-lg focus:border-nova-primary focus:outline-none focus:ring-2 focus:ring-nova-primary/20"
            autofocus
            @keyup.enter="createBusiness"
          />

          <p v-if="error" class="mt-3 text-sm text-red-500">{{ error }}</p>

          <div class="mt-6 flex gap-3">
            <button
              class="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700"
              @click="step = 1"
            >
              Atrás
            </button>
            <button
              class="flex-1 rounded-xl bg-nova-primary py-3 text-sm font-medium text-white disabled:opacity-50"
              :disabled="!businessName.trim() || isSubmitting"
              @click="createBusiness"
            >
              {{ isSubmitting ? "Creando..." : "Crear negocio" }}
            </button>
          </div>
        </div>
      </div>

      <!-- Step 3: Done -->
      <div v-else class="text-center">
        <div class="mb-4 text-5xl">✓</div>
        <h1 class="text-2xl font-bold text-gray-900">
          ¡Listo!
        </h1>
        <p class="mt-2 text-gray-500">
          {{ businessName }} está configurado. Nova pre-configuró categorías y
          cuentas contables para tu tipo de negocio.
        </p>

        <NuxtLink
          to="/"
          class="mt-8 inline-block rounded-xl bg-nova-primary px-8 py-3 font-medium text-white"
        >
          Ir al dashboard
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
