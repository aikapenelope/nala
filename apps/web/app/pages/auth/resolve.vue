<script setup lang="ts">
/**
 * Post-Clerk-login resolver page.
 *
 * Waits for Clerk to be fully loaded, then resolves the Nova user.
 * With Clerk Organizations + "Membership required", Clerk handles
 * the org selection automatically via session tasks. By the time
 * the user reaches this page, they should have an active org.
 *
 * If GET /api/me fails (no org, error), retries a few times then
 * shows an error or redirects to onboarding.
 */

definePageMeta({ layout: false });

const router = useRouter();
const { resolveUser, isAuthenticated } = useNovaAuth();

const error = ref("");
const isResolving = ref(true);

const MAX_ATTEMPTS = 4;
const RETRY_DELAY = 2000;

async function resolve() {
  isResolving.value = true;
  error.value = "";

  // Already resolved
  if (isAuthenticated.value) {
    router.replace("/");
    return;
  }

  // Wait for Clerk to be fully loaded
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded.value) {
    // Poll until loaded (max 10s)
    const start = Date.now();
    while (!isLoaded.value && Date.now() - start < 10_000) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (!isLoaded.value || !isSignedIn.value) {
    router.replace("/landing");
    return;
  }

  // Retry loop: resolve the Nova user from the backend
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = await resolveUser();

    if (result.status === "ok") {
      router.replace("/");
      return;
    }

    if (result.status === "no_org" && attempt >= 1) {
      // After at least one retry, if still no org, go to onboarding
      router.replace("/onboarding");
      return;
    }

    // Wait before retrying
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
    }
  }

  // All attempts failed
  error.value =
    "No se pudo conectar con el servidor. Verifica tu conexion e intenta de nuevo.";
  isResolving.value = false;
}

onMounted(() => {
  resolve();
});
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#f8f7ff] via-[#f0eef9] to-[#e8e4f3] px-4"
  >
    <div v-if="isResolving" class="text-center">
      <div
        class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-3 border-nova-accent/30 border-t-nova-accent"
      />
      <p class="text-sm font-medium text-gray-600">Conectando tu cuenta...</p>
      <p class="mt-1 text-[11px] text-gray-400">Esto puede tomar unos segundos</p>
    </div>

    <div v-else-if="error" class="max-w-sm text-center">
      <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
        <span class="text-2xl">!</span>
      </div>
      <p class="text-sm font-semibold text-red-600">{{ error }}</p>
      <button
        class="mt-4 dark-pill rounded-2xl px-6 py-2.5 text-sm font-bold transition-spring"
        @click="resolve"
      >
        Reintentar
      </button>
      <NuxtLink
        to="/landing"
        class="mt-3 block text-xs font-bold text-gray-400 transition-spring hover:text-gray-600"
      >
        Volver al inicio
      </NuxtLink>
    </div>
  </div>
</template>
