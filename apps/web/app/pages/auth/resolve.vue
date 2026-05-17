<script setup lang="ts">
/**
 * Post-login resolver page.
 *
 * 1. Wait for Clerk to load
 * 2. If not signed in -> landing
 * 3. Call GET /api/me to resolve the Nova user
 * 4. If ok -> dashboard
 * 5. If 404 USER_NOT_FOUND -> onboarding
 * 6. If error -> show error with retry + sign-out buttons
 */

definePageMeta({ layout: false });

const router = useRouter();
const { resolveUser, isAuthenticated, fullLogout } = useNovaAuth();

const error = ref("");
const isResolving = ref(true);
const isSigningOut = ref(false);

const MAX_ATTEMPTS = 3;
const RETRY_DELAY = 2000;

async function resolve() {
  isResolving.value = true;
  error.value = "";

  if (isAuthenticated.value) {
    router.replace("/");
    return;
  }

  // Wait for Clerk to load
  if (import.meta.client) {
    const clerk = useClerk();
    const start = Date.now();
    while (!clerk.value?.loaded && Date.now() - start < 10_000) {
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!clerk.value?.loaded) {
      error.value = "No se pudo cargar la autenticacion. Recarga la pagina.";
      isResolving.value = false;
      return;
    }

    if (!clerk.value?.session) {
      router.replace("/landing");
      return;
    }
  }

  // Retry loop
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = await resolveUser();

    if (result.status === "ok") {
      router.replace("/");
      return;
    }

    if (result.status === "needs_onboarding") {
      router.replace("/onboarding");
      return;
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
    }
  }

  error.value =
    "No se pudo conectar con el servidor. Verifica tu conexion e intenta de nuevo.";
  isResolving.value = false;
}

async function signOut() {
  isSigningOut.value = true;
  try {
    await fullLogout();
  } finally {
    isSigningOut.value = false;
    router.replace("/landing");
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
    <div v-if="isResolving" class="text-center">
      <div
        class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-3 border-nova-accent/30 border-t-nova-accent"
      />
      <p class="text-sm font-medium text-gray-600">Conectando tu cuenta...</p>
      <p class="mt-1 text-[11px] text-gray-400">
        Esto puede tomar unos segundos
      </p>
    </div>

    <div v-else-if="error" class="max-w-sm text-center">
      <div
        class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50"
      >
        <span class="text-2xl">!</span>
      </div>
      <p class="text-sm font-semibold text-red-600">{{ error }}</p>
      <button
        class="mt-4 dark-pill rounded-2xl px-6 py-2.5 text-sm font-bold transition-spring"
        @click="resolve"
      >
        Reintentar
      </button>
      <button
        class="mt-3 block w-full text-xs font-bold text-gray-400 transition-spring hover:text-gray-600"
        :disabled="isSigningOut"
        @click="signOut"
      >
        {{ isSigningOut ? "Cerrando sesion..." : "Cerrar sesion" }}
      </button>
    </div>
  </div>
</template>
