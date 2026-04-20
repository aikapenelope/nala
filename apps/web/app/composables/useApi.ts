/**
 * API client composable.
 *
 * Provides a typed `$api` function that wraps `$fetch` with:
 * - Automatic base URL from runtime config (NUXT_PUBLIC_API_BASE)
 * - Clerk JWT token in Authorization header (device authentication)
 * - X-Acting-As header when an employee is identified via PIN
 * - 401 interceptor: clears stale session and redirects to re-auth
 *
 * IMPORTANT: useAuth() is called once during composable setup (not inside
 * the $api function) because Vue composables that use inject() must be
 * called during the setup phase, not in event handlers.
 *
 * Auth model (AUTH-REFACTOR-PLAN.md):
 * - Clerk JWT authenticates the device (owner signed in once)
 * - X-Acting-As identifies which employee is using the device
 * - The backend resolves the acting user and sets permissions accordingly
 *
 * Usage:
 *   const { $api } = useApi();
 *   const data = await $api('/api/products');
 *   const sale = await $api('/api/sales', { method: 'POST', body: { ... } });
 */

import type { NitroFetchOptions } from "nitropack";

export function useApi() {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase as string;

  /**
   * Reactive flag shown by layouts/components when session expires.
   * Must be inside useApi() (not module-level) because useState requires
   * the Nuxt instance context which is only available during setup/composables.
   */
  const sessionExpired = useState<boolean>("session-expired", () => false);

  // Capture Clerk's getToken during setup (not inside $api).
  // useAuth() uses inject() internally, which only works during setup.
  let clerkGetToken: (() => Promise<string | null>) | null = null;

  if (import.meta.client) {
    try {
      const { getToken } = useAuth();
      clerkGetToken = async () => {
        const tokenFn = getToken.value;
        if (!tokenFn) return null;
        return await tokenFn();
      };
    } catch {
      // Clerk not initialized -- clerkGetToken stays null
    }
  }

  /**
   * Handle a 401 response from the API.
   *
   * This means the Clerk JWT expired or was revoked. Clear the stale
   * Nova user and show a banner so the owner knows to re-authenticate.
   *
   * We don't auto-redirect because the user might be mid-sale. Instead
   * we set a reactive flag that the layout shows as a banner.
   */
  function handle401() {
    if (!import.meta.client) return;

    // Prevent multiple triggers
    if (sessionExpired.value) return;
    sessionExpired.value = true;

    // Clear the stale Nova user from both state and localStorage
    const novaUser = useState<unknown>("nova-user");
    novaUser.value = null;
    localStorage.removeItem("nova:user");
  }

  /**
   * Make an authenticated API request.
   *
   * Always attaches the Clerk JWT (device auth).
   * If an employee is acting (PIN-identified), attaches X-Acting-As.
   * On 401, clears session and sets sessionExpired flag.
   */
  async function $api<T = unknown>(
    path: string,
    opts?: NitroFetchOptions<string>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(opts?.headers as Record<string, string> | undefined),
    };

    // Attach Clerk JWT (device authentication)
    if (clerkGetToken) {
      try {
        const token = await clerkGetToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      } catch {
        // Token retrieval failed -- proceed without auth header
      }
    }

    // Attach X-Acting-As only when an employee is identified via PIN.
    // The owner doesn't need this header -- the backend resolves them from the JWT.
    const novaUser = useState<{ id?: string; role?: string } | null>(
      "nova-user",
    );
    if (novaUser.value?.id && novaUser.value?.role === "employee") {
      headers["X-Acting-As"] = novaUser.value.id;
    }

    try {
      return (await $fetch(path, {
        baseURL: apiBase,
        ...opts,
        headers,
      })) as T;
    } catch (err) {
      // Intercept 401: Clerk JWT expired or revoked
      const fetchError = err as { statusCode?: number; status?: number };
      if (
        fetchError.statusCode === 401 ||
        fetchError.status === 401
      ) {
        handle401();
      }
      throw err;
    }
  }

  return { $api, apiBase, sessionExpired };
}
