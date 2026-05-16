/**
 * Owner Lock composable.
 *
 * PIN-based lock for sensitive sections (reports, accounting, accounts).
 * Inspired by Loyverse/Square POS passcode pattern.
 *
 * Design: purely client-side state. No SSR, no useState, no hydration.
 * The lock state lives in module-level refs that reset on every page
 * load. Each OwnerLockGuard calls ensureInitialized() on mount to
 * fetch the lock status from the API if not yet done.
 *
 * Flow:
 * 1. Page loads -> all refs are default (statusChecked=false, enabled=false, unlocked=false)
 * 2. OwnerLockGuard mounts -> calls ensureInitialized()
 * 3. ensureInitialized() fetches GET /api/owner-lock/status -> sets enabled=true/false
 * 4. If enabled && !unlocked -> guard shows PIN overlay
 * 5. User enters PIN -> POST /api/owner-lock/verify -> unlocked=true for 15 min
 * 6. Page reload -> back to step 1 (all state resets)
 */

/** How long the unlock lasts before auto-locking (15 minutes). */
const UNLOCK_DURATION_MS = 15 * 60 * 1000;

/**
 * Extract a user-friendly error message from a $fetch error.
 * $fetch errors have the API response body in err.data.
 */
function extractErrorMessage(err: unknown, fallback: string): string {
  const fetchErr = err as { data?: { error?: string }; message?: string };
  return fetchErr?.data?.error ?? fetchErr?.message ?? fallback;
}

// Module-level state: resets on every full page load (no SSR persistence).
const statusChecked = ref(false);
const lockEnabled = ref(false);
const unlocked = ref(false);
let initPromise: Promise<void> | null = null;
let unlockTimer: ReturnType<typeof setTimeout> | null = null;

export function useOwnerLock() {
  const { $api } = useApi();

  /** True if the lock is active and user has NOT entered the PIN. */
  const isLocked = computed(() => {
    if (!statusChecked.value) return false; // Not yet checked, don't block
    if (!lockEnabled.value) return false;   // Lock not enabled
    return !unlocked.value;
  });

  /** True if the lock feature is enabled (regardless of unlock state). */
  const isEnabled = computed(() => lockEnabled.value);

  /** True while the initial status check is in progress. */
  const isLoading = computed(() => !statusChecked.value);

  /**
   * Ensure the lock status has been fetched from the server.
   * Safe to call multiple times -- only fetches once.
   * Called by OwnerLockGuard on mount and by settings page.
   */
  async function ensureInitialized(): Promise<void> {
    // Already checked
    if (statusChecked.value) return;

    // Already fetching (dedup concurrent calls from multiple guards)
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

  /** Verify PIN and unlock if correct. */
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

  /** Lock again manually. */
  function lock() {
    unlocked.value = false;
    clearTimer();
  }

  function resetTimer() {
    clearTimer();
    unlockTimer = setTimeout(() => {
      unlocked.value = false;
    }, UNLOCK_DURATION_MS);
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
    isLoading: readonly(isLoading),
    ensureInitialized,
    unlock,
    lock,
    setupPin,
    disablePin,
  };
}
