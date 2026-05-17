/**
 * Owner Lock composable.
 *
 * PIN-based lock for sensitive sections (reports, accounting, accounts).
 *
 * Architecture:
 * - Protected pages call useOwnerLockRedirect() in onMounted
 * - This checks the lock status and redirects to /unlock if needed
 * - /unlock page shows PIN pad and redirects back on success
 * - State is module-level refs (client-only, resets on page reload)
 *
 * Why not a middleware or component wrapper:
 * - Middlewares can't use useApi() (depends on useClerk() which needs
 *   component setup context)
 * - Component wrappers have Nuxt auto-import naming issues and SSR
 *   hydration problems
 * - onMounted in each page is the simplest approach that works
 *   reliably with the existing stack (Clerk + Nuxt SSR)
 */

/** How long the unlock lasts before auto-locking (15 minutes). */
const UNLOCK_DURATION_MS = 15 * 60 * 1000;

function extractErrorMessage(err: unknown, fallback: string): string {
  const fetchErr = err as { data?: { error?: string }; message?: string };
  return fetchErr?.data?.error ?? fetchErr?.message ?? fallback;
}

// Module-level state: resets on every full page load.
const statusChecked = ref(false);
const lockEnabled = ref(false);
const unlocked = ref(false);
let initPromise: Promise<void> | null = null;
let unlockTimer: ReturnType<typeof setTimeout> | null = null;

export function useOwnerLock() {
  const { $api } = useApi();

  const isLocked = computed(() => {
    if (!statusChecked.value) return false;
    if (!lockEnabled.value) return false;
    return !unlocked.value;
  });

  const isEnabled = computed(() => lockEnabled.value);

  async function ensureInitialized(): Promise<void> {
    if (statusChecked.value) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        const result = await $api<{ enabled: boolean }>(
          "/api/owner-lock/status",
          { silent: true },
        );
        lockEnabled.value = result.enabled;
      } catch {
        lockEnabled.value = false;
      } finally {
        statusChecked.value = true;
        initPromise = null;
      }
    })();

    return initPromise;
  }

  async function unlock(pin: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await $api<{ valid: boolean; error?: string }>(
        "/api/owner-lock/verify",
        { method: "POST", body: { pin } },
      );

      if (result.valid) {
        unlocked.value = true;
        resetTimer();
        return { success: true };
      }

      return { success: false, error: result.error ?? "Clave incorrecta" };
    } catch (err) {
      return { success: false, error: extractErrorMessage(err, "Clave incorrecta") };
    }
  }

  function lock() {
    unlocked.value = false;
    clearTimer();
  }

  function resetTimer() {
    clearTimer();
    if (import.meta.client) {
      unlockTimer = setTimeout(() => {
        unlocked.value = false;
      }, UNLOCK_DURATION_MS);
    }
  }

  function clearTimer() {
    if (unlockTimer) {
      clearTimeout(unlockTimer);
      unlockTimer = null;
    }
  }

  async function setupPin(
    pin: string,
    currentPin?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await $api("/api/owner-lock/setup", {
        method: "POST",
        body: { pin, currentPin },
      });
      lockEnabled.value = true;
      statusChecked.value = true;
      unlocked.value = true;
      resetTimer();
      return { success: true };
    } catch (err) {
      return { success: false, error: extractErrorMessage(err, "Error configurando clave") };
    }
  }

  async function disablePin(
    pin: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await $api("/api/owner-lock/setup", {
        method: "DELETE",
        body: { pin },
      });
      lockEnabled.value = false;
      unlocked.value = false;
      statusChecked.value = true;
      clearTimer();
      return { success: true };
    } catch (err) {
      return { success: false, error: extractErrorMessage(err, "Error desactivando clave") };
    }
  }

  return {
    isLocked: readonly(isLocked),
    isEnabled: readonly(isEnabled),
    ensureInitialized,
    unlock,
    lock,
    setupPin,
    disablePin,
  };
}

/**
 * Call this in onMounted() of any page that should be locked.
 * It checks the lock status and redirects to /unlock if needed.
 *
 * Usage in a page:
 *   onMounted(() => { useOwnerLockRedirect(); });
 */
export async function useOwnerLockRedirect() {
  if (!import.meta.client) return;

  const { isLocked, ensureInitialized } = useOwnerLock();
  const route = useRoute();
  const router = useRouter();

  await ensureInitialized();

  if (isLocked.value) {
    router.replace({
      path: "/unlock",
      query: { redirect: route.fullPath },
    });
  }
}
