/**
 * Owner Lock composable.
 *
 * PIN-based lock for sensitive sections. Architecture:
 * - Protected pages call useOwnerLockRedirect() in onMounted()
 * - A watcher auto-redirects when the 15-min timer expires
 * - /unlock page shows PIN pad and redirects back on success
 *
 * Why onMounted instead of middleware:
 * useApi() depends on useClerk() which requires Vue component setup
 * context. Nuxt route middlewares don't have this context, so API
 * calls fail silently. onMounted runs inside the component where
 * Clerk is available.
 */

import { LOCKED_ROUTES } from "~/utils/locked-routes";

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
let watcherSetup = false;
let activeScope: ReturnType<typeof effectScope> | null = null;

export function useOwnerLock() {
  const { $api } = useApi();

  /**
   * Fail-closed: while status is unknown, assume locked.
   * This prevents a flash of unprotected content before the API responds.
   * If the API fails, lockEnabled defaults to false (don't block the app).
   */
  const isLocked = computed(() => {
    if (!statusChecked.value) return true; // Fail-closed
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
        // API failed: assume disabled so we don't permanently block the app
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

  /**
   * Set up the lock PIN. After setup, the lock is ACTIVE and LOCKED.
   * The user must enter the PIN to access protected sections.
   */
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
      unlocked.value = false; // Lock immediately after setup
      clearTimer();
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

  /**
   * Set up a watcher that auto-redirects to /unlock when the timer
   * expires and the user is on a protected route.
   *
   * Uses effectScope(true) to create a detached scope that survives
   * component unmounts. Without this, the watcher dies when the first
   * protected page unmounts, breaking auto-redirect for the session.
   */
  function setupAutoRedirect() {
    if (!import.meta.client) return;
    if (watcherSetup) return;
    watcherSetup = true;

    // Stop previous scope if it exists (handles Vite HMR re-evaluation)
    activeScope?.stop();
    activeScope = effectScope(true);
    activeScope.run(() => {
      const router = useRouter();
      const route = useRoute();

      watch(isLocked, (nowLocked) => {
        if (!nowLocked) return;

        const isProtected = LOCKED_ROUTES.some(
          (r) => route.path === r || route.path.startsWith(r + "/"),
        );

        if (isProtected) {
          router.replace({
            path: "/unlock",
            query: { redirect: route.fullPath },
          });
        }
      });
    });
  }

  /** True once the initial status check has completed. */
  const isReady = computed(() => statusChecked.value);

  return {
    isLocked: readonly(isLocked),
    isEnabled: readonly(isEnabled),
    isReady: readonly(isReady),
    ensureInitialized,
    unlock,
    lock,
    setupPin,
    disablePin,
    setupAutoRedirect,
  };
}

/**
 * Call in onMounted() of any protected page.
 * Checks lock status and redirects to /unlock if locked.
 * Also sets up the auto-redirect watcher for timer expiry.
 */
export async function useOwnerLockRedirect() {
  if (!import.meta.client) return;

  const { isLocked, ensureInitialized, setupAutoRedirect } = useOwnerLock();
  const route = useRoute();
  const router = useRouter();

  await ensureInitialized();
  setupAutoRedirect();

  if (isLocked.value) {
    router.replace({
      path: "/unlock",
      query: { redirect: route.fullPath },
    });
  }
}
