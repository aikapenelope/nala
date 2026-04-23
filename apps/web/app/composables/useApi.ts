/**
 * API client composable.
 *
 * Provides a typed `$api` function that wraps `$fetch` with:
 * - Automatic base URL from runtime config (NUXT_PUBLIC_API_BASE)
 * - Clerk JWT token in Authorization header
 * - 401 interceptor: clears stale session and shows re-auth banner
 *
 * Every user (owner and employee) has their own Clerk JWT.
 * No X-Acting-As header is needed.
 *
 * Token acquisition is resilient: if Clerk isn't loaded when the
 * composable is first created, it retries on every $api call until
 * getToken becomes available.
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
   */
  const sessionExpired = useState<boolean>("session-expired", () => false);

  // Capture Clerk's getToken during setup (not inside $api).
  // If Clerk isn't loaded yet, we'll retry on each $api call.
  let clerkGetTokenRef: {
    value: (() => Promise<string | null>) | undefined;
  } | null = null;

  if (import.meta.client) {
    try {
      const { getToken } = useAuth();
      clerkGetTokenRef = getToken;
    } catch {
      // Clerk not initialized yet -- will retry in $api
    }
  }

  /**
   * Try to acquire Clerk's getToken ref if we don't have it yet.
   * Called on every $api request to handle the case where Clerk
   * wasn't loaded when the composable was first created.
   */
  function ensureGetToken(): void {
    if (clerkGetTokenRef) return;
    if (!import.meta.client) return;

    try {
      const { getToken } = useAuth();
      clerkGetTokenRef = getToken;
    } catch {
      // Still not ready
    }
  }

  /**
   * Handle a 401 response from the API.
   */
  function handle401() {
    if (!import.meta.client) return;
    if (sessionExpired.value) return;
    sessionExpired.value = true;

    const novaUser = useState<unknown>("nova-user");
    novaUser.value = null;
    localStorage.removeItem("nova:user");
  }

  /**
   * Make an authenticated API request.
   *
   * @param opts.silent - If true, 401 errors won't trigger the session-expired banner.
   */
  async function $api<T = unknown>(
    path: string,
    opts?: NitroFetchOptions<string> & { silent?: boolean },
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(opts?.headers as Record<string, string> | undefined),
    };

    // Attach Clerk JWT
    if (import.meta.client) {
      // Re-attempt to get the token ref if we don't have it
      ensureGetToken();

      if (clerkGetTokenRef) {
        try {
          const tokenFn = clerkGetTokenRef.value;
          if (tokenFn) {
            const token = await tokenFn();
            if (token) {
              headers["Authorization"] = `Bearer ${token}`;
            }
          }
        } catch {
          // Token retrieval failed -- request will go without auth
        }
      }
    }

    try {
      return (await $fetch(path, {
        baseURL: apiBase,
        ...opts,
        headers,
      })) as T;
    } catch (err) {
      const fetchError = err as { statusCode?: number; status?: number };
      if (
        (fetchError.statusCode === 401 || fetchError.status === 401) &&
        !opts?.silent
      ) {
        handle401();
      }
      throw err;
    }
  }

  return { $api, apiBase, sessionExpired };
}
