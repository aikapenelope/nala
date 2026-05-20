/**
 * Owner Lock composable.
 *
 * PIN-based lock for sensitive sections. Architecture:
 * - A global route middleware (owner-lock.global.ts) intercepts
 *   navigation to protected routes and redirects to /unlock if locked.
 * - A watcher in the layout auto-redirects when the 15-min timer
 *   expires while the user is on a protected route.
 * - /unlock page shows PIN pad and redirects back on success.
 *
 * The middleware approach eliminates:
 * - Content flash (page never mounts if locked)
 * - Duplicate redirects (single interception point)
 * - KeepAlive destruction (layout slot is never conditionally hidden)
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

/**
 * Fetch lock status using $fetch directly.
 * Works in any context (middleware, plugin, component) because it
 * doesn't depend on useClerk() — it gets the token from useAuth().
 *
 * If Clerk hasn't loaded yet, returns { enabled: false } to avoid
 * blocking the app. The middleware will re-check on next navigation.
 */
async function fetchLockStatus(): Promise<{ enabled: boolean }> {
  if (!import.meta.client) return { enabled: false };

  const { isLoaded, getToken } = useAuth();

  // Clerk not ready — can't authenticate the request.
  // Return disabled to avoid blocking; middleware will retry next nav.
  if (!isLoaded.value) return { enabled: false };

  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase as string;
  const headers: Record<string, string> = {};

  try {
    const token = await getToken.value();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch {
    // Token retrieval failed — proceed without auth
  }

  return await $fetch<{ enabled: boolean }>("/api/owner-lock/status", {
    baseURL: apiBase,
    headers,
  });
}

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

  /**
   * Initialize lock status. Idempotent — safe to call multiple times.
   * Uses $fetch directly so it works in middleware, plugins, and components.
   *
   * If Clerk isn't loaded yet, does NOT mark statusChecked = true,
   * allowing the next call to retry once Clerk is ready.
   */
  async function ensureInitialized(): Promise<void> {
    if (statusChecked.value) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        // Check if Clerk is loaded before attempting fetch
        if (import.meta.client) {
          const { isLoaded } = useAuth();
          if (!isLoaded.value) {
            // Clerk not ready — don't mark as checked, allow retry
            return;
          }
        }

        const result = await fetchLockStatus();
        lockEnabled.value = result.enabled;
        statusChecked.value = true;
      } catch {
        // API failed: assume disabled so we don't permanently block the app
        lockEnabled.value = false;
        statusChecked.value = true;
      } finally {
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
  };
}

/**
 * Set up a watcher that auto-redirects to /unlock when the 15-min
 * timer expires and the user is on a protected route.
 *
 * Call this once from the layout component. The watcher lives as long
 * as the layout lives (which is the entire app session).
 */
export function useOwnerLockAutoRedirect() {
  if (!import.meta.client) return;

  const { isLocked } = useOwnerLock();
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
}
