<script setup lang="ts">
/**
 * Post-Clerk-login resolver page.
 *
 * When a user signs in via Clerk but doesn't have a NovaUser set,
 * this page calls GET /api/me to look up their Nova account and
 * set the NovaUser state.
 *
 * Outcomes:
 * - User found: set NovaUser, redirect to dashboard (/)
 * - User not found (no onboarding): redirect to /onboarding
 * - Error: show error with retry option
 */

definePageMeta({ layout: false });

const router = useRouter();
const { resolveClerkUser, isAuthenticated } = useNovaAuth();

const error = ref("");
const isResolving = ref(true);

async function resolve() {
  isResolving.value = true;
  error.value = "";

  // If already authenticated (e.g., restored from localStorage), go to dashboard
  if (isAuthenticated.value) {
    router.replace("/");
    return;
  }

  // Clear any stale Nova user state before resolving.
  // This prevents showing the old account after a re-login.
  if (import.meta.client) {
    localStorage.removeItem("nova:user");
  }

  const result = await resolveClerkUser();

  if (result.status === "ok") {
    router.replace("/");
  } else if (result.status === "not_found") {
    router.replace("/onboarding");
  } else {
    error.value =
      "No se pudo conectar con el servidor. Verifica tu conexion e intenta de nuevo.";
    isResolving.value = false;
  }
}

onMounted(() => {
  resolve();
});
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4"
  >
    <!-- Resolving state -->
    <div v-if="isResolving" class="text-center">
      <div
        class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-nova-primary border-t-transparent"
      />
      <p class="text-sm text-gray-500">Cargando tu cuenta...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="max-w-sm text-center">
      <p class="text-sm text-red-600">{{ error }}</p>
      <button
        class="mt-4 rounded-lg bg-nova-primary px-6 py-2 text-sm font-medium text-white"
        @click="resolve"
      >
        Reintentar
      </button>
      <NuxtLink
        to="/landing"
        class="mt-3 block text-xs text-gray-400 hover:text-gray-600"
      >
        Volver al inicio
      </NuxtLink>
    </div>
  </div>
</template>
