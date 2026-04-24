/**
 * Nova authentication composable.
 *
 * Simple flow:
 * - Clerk handles authentication (email/password, Google, etc.)
 * - After login, GET /api/me resolves the Nova user from the DB
 * - If user not found (404 USER_NOT_FOUND), redirect to onboarding
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

export function useNovaAuth() {
  const novaUser = useState<NovaUser | null>("nova-user", () => null);
  const isAuthenticated = computed(() => novaUser.value !== null);
  const isAdmin = computed(() => novaUser.value?.role === "owner");
  const isEmployee = computed(() => novaUser.value?.role === "employee");

  const { $api } = useApi();

  function setUser(user: NovaUser) {
    novaUser.value = user;
  }

  /**
   * Resolve the Nova user from the backend.
   * Calls GET /api/me which looks up the user by clerkId.
   */
  async function resolveUser(): Promise<{
    status: "ok" | "needs_onboarding" | "error";
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
      }>("/api/me", { silent: true });

      if (result.user) {
        setUser({
          id: result.user.id,
          name: result.user.name,
          role: result.user.role as UserRole,
          businessId: result.user.businessId,
          businessName: result.user.businessName,
        });

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

      // 404 USER_NOT_FOUND -> user signed up but hasn't created a business yet
      if (
        fetchError.statusCode === 404 &&
        fetchError.data?.code === "USER_NOT_FOUND"
      ) {
        return { status: "needs_onboarding" };
      }

      return { status: "error" };
    }
  }

  function clearUser() {
    novaUser.value = null;
  }

  async function fullLogout() {
    novaUser.value = null;
    if (import.meta.client) {
      localStorage.removeItem("nova:sidebar-collapsed");
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
