<script setup lang="ts">
/**
 * Post-Clerk-login resolver page.
 *
 * Waits for Clerk to be fully loaded and signed in, then resolves
 * the Nova user via GET /api/me.
 *
 * With Clerk Organizations + "Membership required", Clerk handles
 * the org selection automatically via session tasks within the
 * SignIn/SignUp components. By the time the user reaches this page,
 * they should have an active org in their JWT.
 *
 * Flow:
 * 1. Wait for Clerk isLoaded + isSignedIn (reactive watch, no polling)
 * 2. Call resolveUser() which hits GET /api/me
 * 3. If ok -> dashboard
 * 4. If no_org -> onboarding (user needs to create a business)
 * 5. If error -> retry up to MAX_ATTEMPTS, then show error with sign-out option
 */

definePageMeta({ layout: false });

const router = useRouter();
const { resolveUser, isAuthenticated, fullLogout } = useNovaAuth();
const { isLoaded, isSignedIn } = useAuth();

const error = ref("");
const isResolving = ref(true);
const isSigningOut = ref(false);

const MAX_ATTEMPTS = 5;
const RETRY_DELAY = 1500;

/**
 * Wait for a reactive ref to become truthy, with a timeout.
 * Returns true if the condition was met, false if timed out.
 */
function waitFor(
  condition: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (condition()) {
      resolve(true);
      return;
    }

    const timeout = setTimeout(() => {
      unwatch();
      resolve(false);
    }, timeoutMs);

    const unwatch = watch(
      condition,
      (val) => {
        if (val) {
          clearTimeout(timeout);
          unwatch();
          resolve(true);
        }
      },
      { immediate: true },
    );
  });
}

async function resolve() {
  isResolving.value = true;
  error.value = "";

  // Already resolved -- go to dashboard
  if (isAuthenticated.value) {
    router.replace("/");
    return;
  }

  // Wait for Clerk to finish loading (max 15s)
  const loaded = await waitFor(() => isLoaded.value === true, 15_000);
  if (!loaded) {
    error.value = "Clerk no pudo cargar. Verifica tu conexion.";
    isResolving.value = false;
    return;
  }

  // If not signed in after Clerk loaded, go to landing
  if (!isSignedIn.value) {
    router.replace("/landing");
    return;
  }

  // Retry loop: resolve the Nova user from the backend.
  // The JWT should already contain orgId if the user has an active org.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = await resolveUser();

    if (result.status === "ok") {
      router.replace("/");
      return;
    }

    if (result.status === "no_org") {
      // User is signed in but has no org -> needs onboarding
      router.replace("/onboarding");
      return;
    }

    // "error" status -- wait and retry (backend may be starting up)
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
    }
  }

  // All attempts failed
  error.value =
    "No se pudo conectar con el servidor. Verifica tu conexion e intenta de nuevo.";
  isResolving.value = false;
}

/**
 * Sign out of Clerk and redirect to landing.
 * This breaks the loop when the backend is unreachable:
 * resolve fails -> user clicks sign out -> Clerk session cleared -> landing.
 */
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
