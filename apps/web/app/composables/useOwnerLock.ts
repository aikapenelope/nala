/**
 * Owner Lock composable.
 *
 * Manages the PIN-based lock for sensitive sections (costs, reports,
 * settings, accounting). Inspired by Loyverse/Square POS passcode.
 *
 * How it works:
 * - On app load, checks GET /api/owner-lock/status to know if lock is enabled
 * - If enabled, sensitive sections show a lock overlay
 * - User enters 4-digit PIN -> POST /api/owner-lock/verify
 * - If correct, sections unlock for `UNLOCK_DURATION_MS` (15 minutes)
 * - After timeout, auto-locks again
 * - State is in-memory only (page reload = locked again)
 *
 * Usage in pages:
 *   const { isLocked, unlock } = useOwnerLock();
 *   <OwnerLockGuard> ...sensitive content... </OwnerLockGuard>
 */

/** How long the unlock lasts before auto-locking (15 minutes). */
const UNLOCK_DURATION_MS = 15 * 60 * 1000;

/** Whether the lock feature is enabled for this business. */
const lockEnabled = ref<boolean | null>(null);

/** Whether the user has entered the correct PIN (temporary unlock). */
const unlocked = ref(false);

/** Timestamp when the unlock expires. */
let unlockTimer: ReturnType<typeof setTimeout> | null = null;

export function useOwnerLock() {
  const { $api } = useApi();

  /**
   * True if the lock is active and the user has NOT entered the PIN.
   * False if lock is disabled OR user has unlocked.
   * Null while loading status.
   */
  const isLocked = computed(() => {
    if (lockEnabled.value === null) return false; // Loading: don't block
    if (!lockEnabled.value) return false; // Lock not enabled
    return !unlocked.value;
  });

  /** True if the lock feature is enabled (regardless of unlock state). */
  const isEnabled = computed(() => lockEnabled.value === true);

  /** Check lock status from the server. Called once on app init. */
  async function checkStatus() {
    try {
      const result = await $api<{ enabled: boolean }>(
        "/api/owner-lock/status",
        { silent: true },
      );
      lockEnabled.value = result.enabled;
    } catch {
      // If we can't check, assume disabled (don't block the app)
      lockEnabled.value = false;
    }
  }

  /** Verify PIN and unlock if correct. Returns true on success. */
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
      const message = err instanceof Error ? err.message : "Error verificando clave";
      return { success: false, error: message };
    }
  }

  /** Lock again (manual or auto after timeout). */
  function lock() {
    unlocked.value = false;
    clearTimer();
  }

  /** Reset the auto-lock timer (called on each unlock and user interaction). */
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
      unlocked.value = true;
      resetTimer();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error configurando clave";
      return { success: false, error: message };
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
      clearTimer();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desactivando clave";
      return { success: false, error: message };
    }
  }

  /** Refresh lock status (e.g., after setup/disable from settings). */
  async function refresh() {
    await checkStatus();
  }

  return {
    /** True if sensitive sections should be hidden. */
    isLocked: readonly(isLocked),
    /** True if the lock feature is enabled for this business. */
    isEnabled: readonly(isEnabled),
    /** Check lock status from server (call on app init). */
    checkStatus,
    /** Verify PIN and unlock temporarily. */
    unlock,
    /** Lock again manually. */
    lock,
    /** Create or change PIN. */
    setupPin,
    /** Disable PIN (requires current PIN). */
    disablePin,
    /** Refresh status from server. */
    refresh,
  };
}
