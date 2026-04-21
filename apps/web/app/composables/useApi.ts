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
  let clerkGetTokenRef: {
    value: (() => Promise<string | null>) | undefined;
  } | null = null;
  let clerkInitFailed = false;

  if (import.meta.client) {
    try {
      const { getToken } = useAuth();
      clerkGetTokenRef = getToken;
    } catch {
      clerkInitFailed = true;
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
      if (clerkInitFailed && !clerkGetTokenRef) {
        try {
          const { getToken } = useAuth();
          clerkGetTokenRef = getToken;
          clerkInitFailed = false;
        } catch {
          // Still not ready
        }
      }

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
          // Token retrieval failed
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
