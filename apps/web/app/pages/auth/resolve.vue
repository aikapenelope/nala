<script setup lang="ts">
/**
 * Post-Clerk-login resolver page.
 *
 * Single entry point after any Clerk sign-in/sign-up.
 * Ensures the user has an active Organization and a resolved NovaUser.
 *
 * Strategy: retry the full flow up to MAX_ATTEMPTS times with delays.
 * This handles all timing issues (Clerk loading, org memberships loading,
 * session token refresh after setActive).
 */

definePageMeta({ layout: false });

const router = useRouter();
const { resolveUser, isAuthenticated } = useNovaAuth();

const error = ref("");
const isResolving = ref(true);

const MAX_ATTEMPTS = 5;
const ATTEMPT_DELAY = 1500;
const CLERK_LOAD_TIMEOUT = 10_000;
const CLERK_LOAD_POLL = 200;

async function waitForClerkLoaded(): Promise<boolean> {
  try {
    const { isLoaded } = useAuth();
    if (isLoaded.value) return true;

    const start = Date.now();
    while (!isLoaded.value && Date.now() - start < CLERK_LOAD_TIMEOUT) {
      await new Promise((r) => setTimeout(r, CLERK_LOAD_POLL));
    }
    return isLoaded.value;
  } catch {
    return false;
  }
}

/**
 * Try to activate an org if the user has memberships but no active org.
 */
async function activateOrgIfNeeded(): Promise<void> {
  try {
    const { orgId } = useAuth();
    if (orgId.value) return; // Already active

    const clerk = useClerk();
    if (!clerk.value?.user) return;

    const memberships = clerk.value.user.organizationMemberships;
    if (!memberships || memberships.length === 0) return;

    const first = memberships[0];
    if (!first) return;

    await clerk.value.setActive({ organization: first.organization.id });
    // Give the session token time to refresh
    await new Promise((r) => setTimeout(r, 1000));
  } catch {
    // Non-fatal -- the retry loop will handle it
  }
}

async function resolve() {
  isResolving.value = true;
  error.value = "";

  if (isAuthenticated.value) {
    router.replace("/");
    return;
  }

  if (!import.meta.client) return;

  // Step 1: Wait for Clerk to load
  const clerkReady = await waitForClerkLoaded();
  if (!clerkReady) {
    error.value =
      "El servicio de autenticacion no pudo cargar. Recarga la pagina.";
    isResolving.value = false;
    return;
  }

  // Step 2: Check if user is signed in at all
  try {
    const { isSignedIn } = useAuth();
    if (!isSignedIn.value) {
      router.replace("/landing");
      return;
    }
  } catch {
    router.replace("/landing");
    return;
  }

  // Step 3: Try to activate org and resolve user, with retries
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Try to activate an org if needed
    await activateOrgIfNeeded();

    // Try to resolve the Nova user
    const result = await resolveUser();

    if (result.status === "ok") {
      router.replace("/");
      return;
    }

    if (result.status === "no_org") {
      // Check if user has ANY memberships (they might just not be loaded yet)
      try {
        const clerk = useClerk();
        const memberships = clerk.value?.user?.organizationMemberships;
        if (!memberships || memberships.length === 0) {
          // Truly no org -- needs onboarding
          router.replace("/onboarding");
          return;
        }
        // Has memberships but org not active yet -- retry
      } catch {
        router.replace("/onboarding");
        return;
      }
    }

    // Wait before retrying
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, ATTEMPT_DELAY));
    }
  }

  // All attempts exhausted
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
