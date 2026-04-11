/**
 * API client composable.
 *
 * Provides a typed `$api` function that wraps `$fetch` with:
 * - Automatic base URL from runtime config (NUXT_PUBLIC_API_BASE)
 * - Clerk JWT token in Authorization header (when authenticated)
 * - Business ID header for PIN-authenticated sessions
 * - Consistent error handling
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
    if (import.meta.client) {
      try {
        // @clerk/nuxt provides useAuth() where getToken is a ComputedRef<GetToken>
        const { getToken } = useAuth();
        const tokenFn = getToken.value;
        if (tokenFn) {
          const token = await tokenFn();
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
        }
      } catch {
        // Clerk not initialized or not on a page with auth -- skip
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
