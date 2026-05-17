/**
 * Owner Lock composable.
 *
 * PIN-based lock for sensitive sections (reports, accounting, accounts).
 *
 * Architecture: route middleware + dedicated /unlock page.
 * The middleware (owner-lock.global.ts) intercepts navigation to
 * protected routes and redirects to /unlock if the lock is active.
 * The /unlock page shows a PIN pad and redirects back on success.
 *
 * State is module-level refs (client-side only, resets on page reload).
 * The middleware calls ensureInitialized() to fetch lock status from
 * the API before making the redirect decision.
 */

/** How long the unlock lasts before auto-locking (15 minutes). */
const UNLOCK_DURATION_MS = 15 * 60 * 1000;

/**
 * Extract a user-friendly error message from a $fetch error.
 * $fetch errors store the API response body in err.data.
 */
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

  /** True if the lock is active and user has NOT entered the PIN. */
  const isLocked = computed(() => {
    if (!statusChecked.value) return false;
    if (!lockEnabled.value) return false;
    return !unlocked.value;
  });

  /** True if the lock feature is enabled (regardless of unlock state). */
  const isEnabled = computed(() => lockEnabled.value);

  /**
   * Fetch lock status from the server. Called by the route middleware
   * and by the settings page. Deduplicates concurrent calls.
   */
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

  /** Verify PIN and unlock. */
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

  /** Set up the lock PIN (create or change). */
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

  /** Disable the lock (requires current PIN). */
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
