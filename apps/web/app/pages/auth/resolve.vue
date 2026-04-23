<script setup lang="ts">
/**
 * Post-Clerk-login resolver page.
 *
 * This is the single entry point after any Clerk sign-in.
 * It ensures the user has an active Organization and a resolved
 * NovaUser before allowing access to the app.
 *
 * Flow:
 * 1. Wait for Clerk to load
 * 2. If no active org in session, try to activate one from memberships
 * 3. Call GET /api/me to resolve the Nova user
 * 4. If ok -> dashboard. If no_org -> onboarding. If error -> show error.
 */

definePageMeta({ layout: false });

const router = useRouter();
const { resolveUser, isAuthenticated } = useNovaAuth();

const error = ref("");
const isResolving = ref(true);

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
 * Ensure the user has an active Organization in their Clerk session.
 * If they have memberships but no active org, activate the first one.
 * Returns true if an org is active (either already was or just activated).
 */
async function ensureActiveOrg(): Promise<boolean> {
  try {
    const { orgId } = useAuth();

    // Already has an active org
    if (orgId.value) return true;

    // No active org -- check memberships and activate one
    const clerk = useClerk();
    if (!clerk.value?.user) return false;

    // Wait for user data to be fully loaded (memberships may not be
    // available immediately after Clerk loads)
    let attempts = 0;
    while (attempts < 10) {
      const memberships = clerk.value.user.organizationMemberships;
      if (memberships && memberships.length > 0) {
        const firstMembership = memberships[0];
        if (firstMembership) {
          await clerk.value.setActive({
            organization: firstMembership.organization.id,
          });
          // Wait for session token to refresh with the new orgId
          await new Promise((r) => setTimeout(r, 800));
          return true;
        }
      }
      // Memberships not loaded yet -- wait and retry
      await new Promise((r) => setTimeout(r, 300));
      attempts++;
    }

    return false;
  } catch {
    return false;
  }
}

async function resolve() {
  isResolving.value = true;
  error.value = "";

  // Already resolved -- go to dashboard
  if (isAuthenticated.value) {
    router.replace("/");
    return;
  }

  // Wait for Clerk
  if (import.meta.client) {
    const clerkReady = await waitForClerkLoaded();
    if (!clerkReady) {
      error.value =
        "El servicio de autenticacion no pudo cargar. Recarga la pagina.";
      isResolving.value = false;
      return;
    }

    // Ensure the user has an active org before calling the API
    const hasOrg = await ensureActiveOrg();

    if (!hasOrg) {
      // No org memberships at all -- needs onboarding
      router.replace("/onboarding");
      return;
    }
  }

  // Now the JWT should have orgId -- resolve the Nova user
  const result = await resolveUser();

  if (result.status === "ok") {
    router.replace("/");
    return;
  }

  if (result.status === "no_org") {
    // This shouldn't happen after ensureActiveOrg, but handle it
    router.replace("/onboarding");
    return;
  }

  // Error
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
