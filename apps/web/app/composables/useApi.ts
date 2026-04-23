/**
 * API client composable.
 *
 * Provides a typed `$api` function that wraps `$fetch` with:
 * - Automatic base URL from runtime config (NUXT_PUBLIC_API_BASE)
 * - Clerk JWT token in Authorization header (includes orgId)
 * - 401 interceptor: clears stale session and shows re-auth banner
 *
 * With Clerk Organizations, the JWT automatically includes the
 * active Organization's ID and role. No custom headers needed.
 */

import type { NitroFetchOptions } from "nitropack";

export function useApi() {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase as string;

  /**
   * Reactive flag shown by layouts/components when session expires.
   */
  const sessionExpired = useState<boolean>("session-expired", () => false);

  /**
   * Get a fresh Clerk JWT token.
   * Returns null on SSR or if Clerk is not ready.
   */
  async function getClerkToken(): Promise<string | null> {
    if (!import.meta.client) return null;

    try {
      const { getToken } = useAuth();
      const tokenFn = getToken.value;
      if (tokenFn) {
        return await tokenFn();
      }
    } catch {
      // Clerk not initialized yet -- return null
    }

    return null;
  }

  /** Handle a 401 response from the API. */
  function handle401() {
    if (!import.meta.client) return;
    if (sessionExpired.value) return;
    sessionExpired.value = true;

    const novaUser = useState<unknown>("nova-user");
    novaUser.value = null;
  }

  /**
   * Make an authenticated API request.
   */
  async function $api<T = unknown>(
    path: string,
    opts?: NitroFetchOptions<string> & { silent?: boolean },
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(opts?.headers as Record<string, string> | undefined),
    };

    // Attach Clerk JWT (includes orgId automatically)
    const token = await getClerkToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
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
