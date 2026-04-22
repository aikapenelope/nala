/**
 * Nova authentication composable.
 *
 * Unified auth interface for the app. Manages:
 * - Current active user (owner or employee)
 * - Clerk user resolution after login or sign-in token
 *
 * Auth model:
 * - Every user (owner and employee) has their own Clerk account
 * - Clerk JWT authenticates each user directly
 * - No PIN, no roster, no X-Acting-As
 */

import type { UserRole } from "@nova/shared";

/** Nova user as seen by the frontend. */
export interface NovaUser {
  id: string;
  name: string;
  role: UserRole;
  businessId: string;
  businessName: string;
  clerkId?: string;
}

/**
 * Main auth composable for Nova.
 */
export function useNovaAuth() {
  const novaUser = useState<NovaUser | null>("nova-user", () => null);
  const isAuthenticated = computed(() => novaUser.value !== null);
  const isAdmin = computed(() => novaUser.value?.role === "owner");
  const isEmployee = computed(() => novaUser.value?.role === "employee");

  const { $api } = useApi();

  /**
   * Set the current Nova user.
   * Persists to localStorage so the session survives page reloads.
   */
  function setUser(user: NovaUser) {
    novaUser.value = user;
    if (import.meta.client) {
      localStorage.setItem("nova:user", JSON.stringify(user));
    }
  }

  /**
   * Restore user from localStorage on app init.
   */
  function restoreUser() {
    if (!import.meta.client) return;
    const stored = localStorage.getItem("nova:user");
    if (stored) {
      try {
        novaUser.value = JSON.parse(stored) as NovaUser;
      } catch {
        localStorage.removeItem("nova:user");
      }
    }
  }

  /**
   * Resolve the Nova user from the backend after Clerk login.
   * Calls GET /api/me to look up the user's Nova account.
   */
  async function resolveClerkUser(): Promise<{
    status: "ok" | "not_found" | "error";
  }> {
    try {
      const result = await $api<{
        user: {
          id: string;
          name: string;
          role: string;
          businessId: string;
          businessName: string;
          clerkId?: string;
        };
      }>("/api/me");

      if (result.user) {
        setUser({
          id: result.user.id,
          name: result.user.name,
          role: result.user.role as "owner" | "employee",
          businessId: result.user.businessId,
          businessName: result.user.businessName,
          clerkId: result.user.clerkId,
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

      if (
        fetchError.statusCode === 404 &&
        fetchError.data?.code === "USER_NOT_FOUND"
      ) {
        return { status: "not_found" };
      }

      return { status: "error" };
    }
  }

  /**
   * Clear the current user (logout).
   */
  function clearUser() {
    novaUser.value = null;
    if (import.meta.client) {
      localStorage.removeItem("nova:user");
    }
  }

  /**
   * Full logout: signs out of Clerk and clears everything.
   * After this, the user must re-authenticate.
   */
  async function fullLogout() {
    // Clear Nova state first
    novaUser.value = null;
    if (import.meta.client) {
      localStorage.removeItem("nova:user");
      localStorage.removeItem("nova:sidebar-collapsed");
    }

    // Sign out of Clerk (this invalidates the JWT)
    if (import.meta.client) {
      try {
        const clerk = useClerk();
        if (clerk.value) {
          await clerk.value.signOut();
        }
      } catch {
        // Clerk may not be initialized -- session is already cleared locally
      }
    }
  }

  return {
    user: readonly(novaUser),
    isAuthenticated,
    isAdmin,
    isEmployee,
    setUser,
    restoreUser,
    resolveClerkUser,
    clearUser,
    fullLogout,
  };
}
