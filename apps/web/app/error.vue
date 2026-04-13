<script setup lang="ts">
/**
 * Global error boundary page.
 *
 * Nuxt renders this component when an unhandled error occurs anywhere
 * in the app (route not found, API failure during SSR, runtime crash).
 *
 * Provides a user-friendly message and a button to recover.
 */

import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();

const is404 = computed(() => props.error.statusCode === 404);

const title = computed(() =>
  is404.value ? "Pagina no encontrada" : "Algo salio mal",
);

const description = computed(() =>
  is404.value
    ? "La pagina que buscas no existe o fue movida."
    : "Ocurrio un error inesperado. Intenta de nuevo.",
);

/** Clear the error and navigate home. */
function handleRecover() {
  clearError({ redirect: "/" });
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="max-w-md text-center">
      <p class="text-6xl font-bold text-gray-300">
        {{ error.statusCode ?? "Error" }}
      </p>
      <h1 class="mt-4 text-xl font-semibold text-gray-900">
        {{ title }}
      </h1>
      <p class="mt-2 text-sm text-gray-500">
        {{ description }}
      </p>
      <button
        class="mt-6 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        @click="handleRecover"
      >
        Volver al inicio
      </button>
    </div>
  </div>
</template>
