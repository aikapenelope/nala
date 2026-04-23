<script setup lang="ts">
/**
 * Post-Clerk-login resolver page.
 *
 * When a user signs in via Clerk but doesn't have a NovaUser set,
 * this page calls GET /api/me to look up their Nova account and
 * set the NovaUser state.
 *
 * CRITICAL: Must wait for Clerk to finish loading (isLoaded = true)
 * before attempting to resolve. Without this, getToken() returns null
 * and all API calls fail with 401.
 *
 * Outcomes:
 * - User found: set NovaUser, redirect to dashboard (/)
 * - User not found + has employee metadata: show "account being set up"
 *   with extended retry (webhook may be in transit)
 * - User not found + no metadata: redirect to /onboarding (new owner)
 * - Error: show error with retry option
 */

definePageMeta({ layout: false });

const router = useRouter();
const { resolveClerkUser, isAuthenticated, clearUser } = useNovaAuth();

const error = ref("");
const isResolving = ref(true);

/** Whether the user appears to be an invited employee (not a new owner). */
const isEmployeeWaiting = ref(false);

/** Maximum retries for employee linking (webhook may take a few seconds). */
const EMPLOYEE_MAX_RETRIES = 6;
/** Delay between retries for employee linking (ms). */
const EMPLOYEE_RETRY_DELAY = 2000;
/** Standard retries for token propagation. */
const STANDARD_MAX_RETRIES = 3;
const STANDARD_RETRY_DELAY = 2000;
/** Maximum time to wait for Clerk to load (ms). */
const CLERK_LOAD_TIMEOUT = 10_000;
/** Polling interval to check if Clerk is loaded (ms). */
const CLERK_LOAD_POLL = 200;

/**
 * Wait for Clerk to finish initializing.
 * Returns true if Clerk loaded, false if timed out.
 */
async function waitForClerkLoaded(): Promise<boolean> {
  try {
    const { isLoaded } = useAuth();

    if (isLoaded.value) return true;

    // Poll until loaded or timeout
    const start = Date.now();
    while (!isLoaded.value && Date.now() - start < CLERK_LOAD_TIMEOUT) {
      await new Promise((r) => setTimeout(r, CLERK_LOAD_POLL));
    }

    return isLoaded.value;
  } catch {
    // useAuth() not available (SSR or Clerk not initialized)
    return false;
  }
}

async function resolve() {
  isResolving.value = true;
  error.value = "";
  isEmployeeWaiting.value = false;

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

  // --- Wait for Clerk to be ready ---
  // This is critical: after accepting an invitation or signing in,
  // Clerk needs time to initialize and make the JWT available.
  // Without this wait, getToken() returns null and all API calls get 401.
  if (import.meta.client) {
    const clerkReady = await waitForClerkLoaded();
    if (!clerkReady) {
      error.value =
        "El servicio de autenticacion no pudo cargar. Recarga la pagina e intenta de nuevo.";
      isResolving.value = false;
      return;
    }
  }

  // Try to resolve with retry. Even after Clerk loads, the JWT may
  // need a moment to propagate to getToken().
  let lastStatus: "ok" | "not_found" | "error" = "error";

  for (let attempt = 0; attempt < STANDARD_MAX_RETRIES; attempt++) {
    const result = await resolveClerkUser();
    lastStatus = result.status;

    if (result.status === "ok") {
      router.replace("/");
      return;
    }

    if (result.status === "not_found") {
      // Check if this is an invited employee whose account is still
      // being linked (webhook in transit). Clerk's publicMetadata
      // is available on the client via useUser().
      const isEmployee = await checkIfInvitedEmployee();

      if (isEmployee) {
        // Don't redirect to onboarding -- this is an employee.
        // Enter extended retry mode waiting for the webhook to link.
        isEmployeeWaiting.value = true;
        await resolveWithEmployeeRetry();
        return;
      }

      // Not an employee -- this is a new owner who needs onboarding.
      router.replace("/onboarding");
      return;
    }

    // Wait before retrying (token may need time to propagate)
    if (attempt < STANDARD_MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, STANDARD_RETRY_DELAY));
    }
  }

  if (lastStatus === "error") {
    error.value =
      "No se pudo conectar con el servidor. Verifica tu conexion e intenta de nuevo.";
    isResolving.value = false;
  }
}

/**
 * Check if the current Clerk user has employee metadata from an invitation.
 * Returns true if publicMetadata contains role=employee or novaUserId.
 */
async function checkIfInvitedEmployee(): Promise<boolean> {
  try {
    const { user: clerkUser } = useUser();
    if (!clerkUser.value) return false;

    const meta = clerkUser.value.publicMetadata as {
      role?: string;
      novaUserId?: string;
      businessId?: string;
    };

    return !!(meta.role === "employee" || meta.novaUserId);
  } catch {
    return false;
  }
}

/**
 * Extended retry loop for invited employees.
 * The webhook may take a few seconds to link the Clerk account to the
 * Nova employee record. We retry GET /api/me with longer intervals.
 */
async function resolveWithEmployeeRetry() {
  for (let attempt = 0; attempt < EMPLOYEE_MAX_RETRIES; attempt++) {
    await new Promise((r) => setTimeout(r, EMPLOYEE_RETRY_DELAY));

    const result = await resolveClerkUser();

    if (result.status === "ok") {
      router.replace("/");
      return;
    }

    // Still not found -- keep waiting
  }

  // Exhausted retries -- show a helpful error
  isEmployeeWaiting.value = false;
  error.value =
    "Tu cuenta de empleado esta siendo configurada. " +
    "Si el problema persiste, pide al administrador que verifique tu invitacion.";
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
    <!-- Resolving state (standard) -->
    <div v-if="isResolving && !isEmployeeWaiting" class="text-center">
      <div
        class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-3 border-nova-accent/30 border-t-nova-accent"
      />
      <p class="text-sm font-medium text-gray-600">Conectando tu cuenta...</p>
      <p class="mt-1 text-[11px] text-gray-400">Esto puede tomar unos segundos</p>
    </div>

    <!-- Employee waiting state (extended retry) -->
    <div v-else-if="isEmployeeWaiting" class="max-w-sm text-center">
      <div
        class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-3 border-nova-accent/30 border-t-nova-accent"
      />
      <p class="text-sm font-medium text-gray-600">
        Configurando tu cuenta de empleado...
      </p>
      <p class="mt-2 text-[11px] text-gray-400">
        Estamos vinculando tu cuenta. Esto puede tomar unos segundos.
      </p>
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
