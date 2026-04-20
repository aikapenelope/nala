<script setup lang="ts">
/**
 * Post-Clerk-login resolver page.
 *
 * When a user signs in via Clerk but doesn't have a NovaUser set,
 * this page calls GET /api/me to look up their Nova account and
 * set the NovaUser state.
 *
 * Includes retry logic because Clerk's JWT may not be immediately
 * available after sign-in (race condition with token propagation).
 *
 * Outcomes:
 * - User found: set NovaUser, redirect to dashboard (/)
 * - User not found (no onboarding): redirect to /onboarding
 * - Error: show error with retry option
 */

definePageMeta({ layout: false });

const router = useRouter();
const { resolveClerkUser, isAuthenticated, clearUser } = useNovaAuth();

const error = ref("");
const isResolving = ref(true);

async function resolve() {
  isResolving.value = true;
  error.value = "";

  // Clear any stale state from previous sessions
  if (import.meta.client) {
    clearUser();
    // Also clear the session-expired flag so the banner doesn't show
    const sessionExpired = useState<boolean>("session-expired");
    sessionExpired.value = false;
  }

  // If already authenticated (e.g., restored from localStorage), go to dashboard
  if (isAuthenticated.value) {
    router.replace("/");
    return;
  }

  // Try to resolve with retry. Clerk's JWT may not be ready immediately
  // after sign-in due to token propagation delay.
  let lastStatus: "ok" | "not_found" | "error" = "error";

  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await resolveClerkUser();
    lastStatus = result.status;

    if (result.status === "ok") {
      router.replace("/");
      return;
    }

    if (result.status === "not_found") {
      router.replace("/onboarding");
      return;
    }

    // Wait before retrying (token may need time to propagate)
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  if (lastStatus === "error") {
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
    class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#f8f7ff] via-[#f0eef9] to-[#e8e4f3] px-4"
  >
    <!-- Resolving state -->
    <div v-if="isResolving" class="text-center">
      <div
        class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-3 border-nova-accent/30 border-t-nova-accent"
      />
      <p class="text-sm font-medium text-gray-600">Conectando tu cuenta...</p>
      <p class="mt-1 text-[11px] text-gray-400">Esto puede tomar unos segundos</p>
    </div>

    <!-- Error state -->
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
