<script setup lang="ts">
/**
 * Post-Clerk-login resolver page.
 *
 * After Clerk sign-in, this page:
 * 1. Waits for Clerk to finish loading (isLoaded)
 * 2. Checks if the user has an active Organization
 * 3. Calls GET /api/me to resolve the Nova user
 * 4. Redirects to dashboard or onboarding
 *
 * With Clerk Organizations, the JWT already contains orgId.
 * The backend auto-creates the user record on first request.
 * No custom linking, no webhooks, no retry loops.
 */

definePageMeta({ layout: false });

const router = useRouter();
const { resolveUser, isAuthenticated } = useNovaAuth();

const error = ref("");
const isResolving = ref(true);

/** Maximum time to wait for Clerk to load (ms). */
const CLERK_LOAD_TIMEOUT = 10_000;
const CLERK_LOAD_POLL = 200;

/**
 * Wait for Clerk to finish initializing.
 */
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

async function resolve() {
  isResolving.value = true;
  error.value = "";

  // If already authenticated, go to dashboard
  if (isAuthenticated.value) {
    router.replace("/");
    return;
  }

  // Wait for Clerk to be ready
  if (import.meta.client) {
    const clerkReady = await waitForClerkLoaded();
    if (!clerkReady) {
      error.value =
        "El servicio de autenticacion no pudo cargar. Recarga la pagina.";
      isResolving.value = false;
      return;
    }
  }

  // Resolve the Nova user via GET /api/me
  // The backend reads orgId from the JWT and auto-creates the user if needed.
  const result = await resolveUser();

  if (result.status === "ok") {
    router.replace("/");
    return;
  }

  if (result.status === "no_org") {
    // User is signed in but has no active Organization in the session.
    // Before redirecting to onboarding, check if they already belong to
    // an org (e.g., they completed onboarding before but the session
    // doesn't have the org set as active). If so, activate it.
    if (import.meta.client) {
      const activated = await tryActivateExistingOrg();
      if (activated) {
        // Org is now active -- retry resolving the user
        const retryResult = await resolveUser();
        if (retryResult.status === "ok") {
          router.replace("/");
          return;
        }
      }
    }

    // No existing org found -- needs onboarding
    router.replace("/onboarding");
    return;
  }

  // Error -- show retry
  error.value =
    "No se pudo conectar con el servidor. Verifica tu conexion e intenta de nuevo.";
  isResolving.value = false;
}

onMounted(() => {
  resolve();
});

/**
 * Try to activate an existing Organization membership.
 * Uses the Clerk client to check if the user belongs to any org,
 * and if so, calls setActive to make it the active org.
 * Returns true if an org was activated.
 */
async function tryActivateExistingOrg(): Promise<boolean> {
  try {
    const clerk = useClerk();
    if (!clerk.value) return false;

    // Get the user's organization memberships
    const memberships =
      clerk.value.user?.organizationMemberships;

    if (!memberships || memberships.length === 0) return false;

    // Activate the first (and likely only) organization
    const firstMembership = memberships[0];
    if (!firstMembership) return false;
    const firstOrg = firstMembership.organization;

    await clerk.value.setActive({
      organization: firstOrg.id,
    });

    // Wait for the session token to update with the new orgId
    await new Promise((r) => setTimeout(r, 500));

    console.info(
      `[resolve] Activated existing org: ${firstOrg.name}`,
    );
    return true;
  } catch {
    return false;
  }
}
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
