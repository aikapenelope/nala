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
 *
 * Token strategy: capture the getToken Ref from useAuth() during
 * composable setup. The Ref is reactive -- its .value updates when
 * Clerk finishes loading. If Clerk isn't ready during initial setup,
 * we retry on each $api call (ensureGetToken).
 */

import type { NitroFetchOptions } from "nitropack";

export function useApi() {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase as string;

  /**
   * Reactive flag shown by layouts/components when session expires.
   */
  const sessionExpired = useState<boolean>("session-expired", () => false);

  // Capture Clerk's getToken Ref during composable setup.
  // getToken is Ref<(opts?) => Promise<string | null>> per Clerk Vue SDK.
  // On SSR or if Clerk isn't ready, this will be null initially.
  type GetTokenFn = (opts?: Record<string, unknown>) => Promise<string | null>;
  type GetTokenRef = { value: GetTokenFn | undefined };
  let clerkGetToken: GetTokenRef | null = null;

  if (import.meta.client) {
    try {
      const { getToken } = useAuth();
      clerkGetToken = getToken as GetTokenRef;
    } catch {
      // Clerk not initialized yet -- will retry in ensureGetToken
    }
  }

  /**
   * Retry capturing getToken if the initial attempt failed.
   * Called synchronously before each $api request.
   */
  function ensureGetToken(): void {
    if (clerkGetToken) return;
    if (!import.meta.client) return;
    try {
      const { getToken } = useAuth();
      clerkGetToken = getToken as GetTokenRef;
    } catch {
      // Still not ready
    }
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

    // Attach Clerk JWT (includes orgId automatically).
    if (import.meta.client) {
      ensureGetToken();

      if (clerkGetToken) {
        try {
          const tokenFn = clerkGetToken.value;
          if (tokenFn) {
            const token = await tokenFn();
            if (token) {
              headers["Authorization"] = `Bearer ${token}`;
            }
          }
        } catch {
          // Token retrieval failed -- request goes without auth
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
