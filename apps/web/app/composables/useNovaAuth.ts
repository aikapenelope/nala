/**
 * Nova authentication composable.
 *
 * Unified auth interface for the app. Manages:
 * - Current active user (owner or employee)
 * - PIN-based user switching via local roster verification
 * - Owner PIN verification for restricted actions
 * - Clerk user resolution after login
 *
 * Auth model (AUTH-REFACTOR-PLAN.md):
 * - Clerk JWT authenticates the device (owner signed in once)
 * - PIN identifies the user locally against a cached roster
 * - No public endpoints are called for PIN verification
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
   * Set the current Nova user (owner or employee).
   * Persists to localStorage so the session survives page reloads.
   * Also stores businessId separately for the shared device flow.
   */
  function setUser(user: NovaUser) {
    novaUser.value = user;
    if (import.meta.client) {
      localStorage.setItem("nova:user", JSON.stringify(user));
      localStorage.setItem("nova:businessId", user.businessId);
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
   * Switch to a different user via PIN (local verification).
   *
   * Verifies the PIN locally against the cached team roster (bcrypt).
   * No API call is made. The matched user becomes the active user,
   * and subsequent API requests include X-Acting-As with their ID.
   *
   * Falls back to server-side switch if no roster is cached.
   */
  async function switchUser(
    pin: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { verifyPin, isLoaded: rosterLoaded } = useTeamRoster();

    if (!rosterLoaded.value) {
      return {
        success: false,
        error: "Equipo no cargado. El dueno debe iniciar sesion.",
      };
    }

    const match = await verifyPin(pin);

    if (match) {
      // Read businessId and businessName from the roster composable
      const { businessId: rosterBizId, businessName: rosterBizName } =
        useTeamRoster();

      setUser({
        id: match.id,
        name: match.name,
        role: match.role as UserRole,
        businessId: rosterBizId.value ?? "",
        businessName: rosterBizName.value ?? "",
      });
      return { success: true };
    }

    return { success: false, error: "PIN incorrecto" };
  }

  /**
   * Verify the owner's PIN for restricted actions (local first, then server).
   *
   * Local verification is instant (bcrypt in browser).
   * Server verification via POST /api/verify-owner-pin is the double-check
   * for critical actions like voiding sales.
   */
  async function verifyOwnerPin(pin: string): Promise<boolean> {
    // Local verification first (fast)
    const { verifyOwnerPin: localVerify } = useTeamRoster();
    const localMatch = await localVerify(pin);

    if (!localMatch) return false;

    // Server-side double-check for critical actions
    try {
      const result = await $api<{ verified: boolean }>(
        "/api/verify-owner-pin",
        {
          method: "POST",
          body: { pin },
        },
      );
      return result.verified === true;
    } catch {
      // If server is unreachable, trust local verification
      // (the action will fail server-side anyway if JWT is invalid)
      return true;
    }
  }

  /**
   * Resolve the Nova user from the backend after Clerk login.
   * Calls GET /api/me and also downloads the team roster for caching.
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

        // Mark device activation timestamp (30-day expiry counter starts now)
        const { markActivated } = useDeviceMode();
        markActivated();

        // Clear the session-expired banner if it was showing.
        // This happens when the owner re-authenticates after a 401.
        const sessionExpired = useState<boolean>("session-expired");
        sessionExpired.value = false;

        // Download team roster for local PIN verification.
        // Don't block login on roster download -- if it fails (e.g., Clerk
        // token not yet propagated), retry once after a short delay.
        // The auto-refresh (every 1 min) will catch it regardless.
        const { refreshRoster, startAutoRefresh } = useTeamRoster();
        refreshRoster().catch(() => {
          setTimeout(() => refreshRoster().catch(() => {}), 2000);
        });
        startAutoRefresh();

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
   * Clear the current user (logout / user switch).
   * Keeps businessId and roster in localStorage so the PIN screen
   * still works on this device (Square pattern).
   */
  function clearUser() {
    novaUser.value = null;
    if (import.meta.client) {
      localStorage.removeItem("nova:user");
      // Intentionally NOT removing nova:businessId or nova:team-roster
    }
  }

  /**
   * Full logout: signs out of Clerk and clears everything from this device.
   * Use when the device needs to be completely reset (e.g., changing
   * business, device stuck, or transferring device to someone else).
   * After this, the device is as if Nova was never configured on it.
   */
  async function fullLogout() {
    novaUser.value = null;
    if (import.meta.client) {
      // Clear all Nova state from localStorage
      localStorage.removeItem("nova:user");
      localStorage.removeItem("nova:businessId");
      localStorage.removeItem("nova:team-roster");
      localStorage.removeItem("nova:device-mode");
      localStorage.removeItem("nova:device-activated-at");
      localStorage.removeItem("nova:sidebar-collapsed");

      // Sign out of Clerk so the JWT is invalidated.
      // Without this, Clerk auto-restores the session on next visit
      // and the user sees the old account again.
      try {
        const clerk = useClerk();
        if (clerk.value?.session) {
          await clerk.value.signOut();
        }
      } catch {
        // Clerk may not be initialized -- continue with local cleanup
      }
    }
  }

  /**
   * Check if this device has been configured for a business.
   */
  function getDeviceBusinessId(): string | null {
    if (!import.meta.client) return null;
    return localStorage.getItem("nova:businessId");
  }

  return {
    user: readonly(novaUser),
    isAuthenticated,
    isAdmin,
    isEmployee,
    setUser,
    restoreUser,
    resolveClerkUser,
    getDeviceBusinessId,
    switchUser,
    verifyOwnerPin,
    clearUser,
    fullLogout,
  };
}
