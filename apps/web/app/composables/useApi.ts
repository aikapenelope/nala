/**
 * API client composable.
 *
 * Provides a typed `$api` function that wraps `$fetch` with:
 * - Automatic base URL from runtime config (NUXT_PUBLIC_API_BASE)
 * - Clerk JWT token in Authorization header (device authentication)
 * - X-Acting-As header when an employee is identified via PIN
 * - Consistent error handling
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
   * Make an authenticated API request.
   *
   * Always attaches the Clerk JWT (device auth).
   * If an employee is acting (PIN-identified), attaches X-Acting-As.
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

    return $fetch<T>(path, {
      baseURL: apiBase,
      ...opts,
      headers,
    });
  }

  return { $api, apiBase };
}
