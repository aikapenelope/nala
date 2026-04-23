/**
 * Nova authentication composable.
 *
 * Uses Clerk Organizations for multi-tenancy:
 * - The user's orgId and orgRole come from Clerk's JWT
 * - No custom linking, no webhooks, no localStorage persistence
 * - The backend auto-creates user records on first API request
 *
 * This composable provides a thin wrapper over Clerk's useAuth()
 * and useOrganization() to expose Nova-specific state.
 */

import type { UserRole } from "@nova/shared";

/** Nova user as seen by the frontend. */
export interface NovaUser {
  id: string;
  name: string;
  role: UserRole;
  businessId: string;
  businessName: string;
}

/**
 * Main auth composable for Nova.
 *
 * Reads auth state from Clerk (via useAuth/useOrganization) and
 * resolves the Nova user from the backend via GET /api/me.
 */
export function useNovaAuth() {
  const novaUser = useState<NovaUser | null>("nova-user", () => null);
  const isAuthenticated = computed(() => novaUser.value !== null);
  const isAdmin = computed(() => novaUser.value?.role === "owner");
  const isEmployee = computed(() => novaUser.value?.role === "employee");

  const { $api } = useApi();

  /**
   * Set the current Nova user.
   */
  function setUser(user: NovaUser) {
    novaUser.value = user;
  }

  /**
   * Resolve the Nova user from the backend after Clerk login.
   * Calls GET /api/me which uses the orgId from the JWT to find
   * the business and auto-create the user if needed.
   */
  async function resolveUser(): Promise<{
    status: "ok" | "no_org" | "error";
  }> {
    try {
      const result = await $api<{
        user: {
          id: string;
          name: string;
          role: string;
          businessId: string;
          businessName: string;
        };
      }>("/api/me");

      if (result.user) {
        setUser({
          id: result.user.id,
          name: result.user.name,
          role: result.user.role as UserRole,
          businessId: result.user.businessId,
          businessName: result.user.businessName,
        });

        // Clear the session-expired banner if it was showing.
        const sessionExpired = useState<boolean>("session-expired");
        sessionExpired.value = false;

        return { status: "ok" };
      }

      return { status: "error" };
    } catch (err) {
      const fetchError = err as {
        statusCode?: number;
        data?: { code?: string };
      };

      // 403 with NO_ORGANIZATION means user needs to select/create an org
      if (
        fetchError.statusCode === 403 &&
        fetchError.data?.code === "NO_ORGANIZATION"
      ) {
        return { status: "no_org" };
      }

      return { status: "error" };
    }
  }

  /**
   * Clear the current user (logout).
   */
  function clearUser() {
    novaUser.value = null;
  }

  /**
   * Full logout: signs out of Clerk and clears everything.
   */
  async function fullLogout() {
    novaUser.value = null;
    if (import.meta.client) {
      localStorage.removeItem("nova:sidebar-collapsed");
    }

    if (import.meta.client) {
      try {
        const clerk = useClerk();
        if (clerk.value) {
          await clerk.value.signOut();
        }
      } catch {
        // Clerk may not be initialized
      }
    }
  }

  return {
    user: readonly(novaUser),
    isAuthenticated,
    isAdmin,
    isEmployee,
    setUser,
    resolveUser,
    clearUser,
    fullLogout,
  };
}
