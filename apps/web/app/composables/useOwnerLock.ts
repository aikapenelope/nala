/**
 * Owner Lock composable.
 *
 * Manages the PIN-based lock for sensitive sections (costs, reports,
 * settings, accounting). Inspired by Loyverse/Square POS passcode.
 *
 * How it works:
 * - On app load, a client plugin calls checkStatus() to fetch lock state
 * - If enabled, sensitive sections show a lock overlay via OwnerLockGuard
 * - User enters 4-digit PIN -> POST /api/owner-lock/verify
 * - If correct, sections unlock for UNLOCK_DURATION_MS (15 minutes)
 * - After timeout, auto-locks again
 * - State uses Nuxt useState (survives client navigation, resets on reload)
 *
 * Usage in pages:
 *   const { isLocked, unlock } = useOwnerLock();
 *   <OwnerLockGuard> ...sensitive content... </OwnerLockGuard>
 */

/** How long the unlock lasts before auto-locking (15 minutes). */
const UNLOCK_DURATION_MS = 15 * 60 * 1000;

/** Timer handle for auto-lock (client-side only, not serializable). */
let unlockTimer: ReturnType<typeof setTimeout> | null = null;

export function useOwnerLock() {
  /**
   * Whether the lock feature is enabled for this business.
   * null = not yet checked, true = enabled, false = disabled.
   * Uses useState so it survives Nuxt client-side navigation.
   */
  const lockEnabled = useState<boolean | null>("owner-lock-enabled", () => null);

  /**
   * Whether the user has entered the correct PIN (temporary unlock).
   * Resets to false on page reload (useState re-initializes from server).
   */
  const unlocked = useState<boolean>("owner-lock-unlocked", () => false);

  const { $api } = useApi();

  /**
   * True if the lock is active and the user has NOT entered the PIN.
   * False if lock is disabled OR user has unlocked OR status not yet loaded.
   */
  const isLocked = computed(() => {
    if (lockEnabled.value === null) return false; // Not yet checked
    if (!lockEnabled.value) return false; // Lock not enabled
    return !unlocked.value;
  });

  /** True if the lock feature is enabled (regardless of unlock state). */
  const isEnabled = computed(() => lockEnabled.value === true);

  /**
   * Check lock status from the server.
   * Called by the owner-lock plugin on every app initialization,
   * and by auth/resolve during login flow.
   */
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

  /** Reset the auto-lock timer. */
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

  /** Refresh lock status from server. */
  async function refresh() {
    await checkStatus();
  }

  return {
    isLocked: readonly(isLocked),
    isEnabled: readonly(isEnabled),
    checkStatus,
    unlock,
    lock,
    setupPin,
    disablePin,
    refresh,
  };
}
