/**
 * API client composable.
 *
 * Simple, robust token acquisition:
 * 1. During setup, capture useClerk() ref (always available with @clerk/nuxt)
 * 2. On each $api call, get token from clerk.session.getToken()
 * 3. Attach as Bearer token in Authorization header
 *
 * No Organizations complexity. Single admin user flow.
 */

import type { NitroFetchOptions } from "nitropack";

export function useApi() {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase as string;

  const sessionExpired = useState<boolean>("session-expired", () => false);

  // Capture the Clerk instance during setup.
  // useClerk() returns a Ref that updates when Clerk loads.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clerkInstance: { value: any } | null = null;

  if (import.meta.client) {
    try {
      clerkInstance = useClerk();
    } catch {
      // Clerk module not ready
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

    // Get token directly from the Clerk instance's active session.
    if (import.meta.client) {
      try {
        const clerk = clerkInstance?.value;
        if (clerk?.session) {
          const token = await clerk.session.getToken();
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
        }
      } catch {
        // Token retrieval failed
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
