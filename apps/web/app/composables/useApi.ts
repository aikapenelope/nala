/**
 * API client composable.
 *
 * Provides a typed `$api` function that wraps `$fetch` with:
 * - Automatic base URL from runtime config (NUXT_PUBLIC_API_BASE)
 * - Clerk JWT token in Authorization header (when authenticated)
 * - Business ID header for PIN-authenticated sessions
 * - Consistent error handling
 *
 * IMPORTANT: useAuth() is called once during composable setup (not inside
 * the $api function) because Vue composables that use inject() must be
 * called during the setup phase, not in event handlers.
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

  // Capture Clerk's getToken during setup (not inside $api).
  // useAuth() uses inject() internally, which only works during setup.
  let clerkGetToken: (() => Promise<string | null>) | null = null;

  if (import.meta.client) {
    try {
      const { getToken } = useAuth();
      // getToken is a ComputedRef<GetToken>. We read .value at call time
      // inside $api, but we capture the ref here during setup.
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
   * Make an authenticated API request.
   *
   * Automatically attaches the Clerk JWT token if available.
   * For PIN-authenticated sessions, attaches the businessId header.
   */
  async function $api<T = unknown>(
    path: string,
    opts?: NitroFetchOptions<string>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(opts?.headers as Record<string, string> | undefined),
    };

    // Attach Clerk JWT if available
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

    // Attach businessId from Nova auth state for PIN sessions
    const novaUser = useState<{ businessId?: string } | null>("nova-user");
    if (novaUser.value?.businessId) {
      headers["X-Business-Id"] = novaUser.value.businessId;
    }

    return $fetch<T>(path, {
      baseURL: apiBase,
      ...opts,
      headers,
    });
  }

  return { $api, apiBase };
}
