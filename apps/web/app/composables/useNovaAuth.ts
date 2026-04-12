/**
 * Nova authentication composable.
 *
 * Wraps Clerk auth (for owners) and PIN auth (for employees)
 * into a unified interface. Provides:
 * - Current user info (name, role, businessId)
 * - isAdmin / isEmployee computed flags
 * - PIN-based user switching for shared devices
 * - Owner PIN verification for restricted actions
 *
 * All methods call the real API. No mock data.
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

/** API response shape from POST /auth/pin. */
interface PinAuthResponse {
  user?: NovaUser;
  error?: string;
  locked?: boolean;
  lockoutMinutes?: number;
}

/** API response shape from POST /api/verify-owner-pin. */
interface OwnerPinResponse {
  verified: boolean;
  ownerId?: string;
  error?: string;
}

/**
 * Main auth composable for Nova.
 *
 * Uses Clerk for owner authentication and a local PIN system
 * for employee access on shared devices.
 */
export function useNovaAuth() {
  const novaUser = useState<NovaUser | null>("nova-user", () => null);
  const isAuthenticated = computed(() => novaUser.value !== null);
  const isAdmin = computed(() => novaUser.value?.role === "owner");
  const isEmployee = computed(() => novaUser.value?.role === "employee");

  const { $api } = useApi();

  /**
   * Set the current Nova user after Clerk login or PIN entry.
   * Called by the onboarding flow or PIN screen.
   * Persists to localStorage so the session survives page reloads.
   *
   * Also stores businessId separately so the PIN screen works on
   * shared devices even after the active user session is cleared
   * (Square pattern: the device stays bound to the business).
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
   * Called once during app startup.
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
   * Switch to a different user via PIN (shared device).
   * Does not log out of Clerk -- the device session stays active.
   *
   * @returns Object with success flag and optional error message.
   */
  async function switchUser(
    pin: string,
    businessId?: string,
  ): Promise<{ success: boolean; error?: string; locked?: boolean }> {
    const bId = businessId ?? novaUser.value?.businessId;
    if (!bId) {
      return { success: false, error: "No business context available" };
    }

    try {
      const result = await $api<PinAuthResponse>("/auth/pin", {
        method: "POST",
        body: { businessId: bId, pin },
      });

      if (result.user) {
        setUser(result.user);
        return { success: true };
      }

      return {
        success: false,
        error: result.error ?? "PIN incorrecto",
        locked: result.locked,
      };
    } catch (err) {
      // Handle HTTP error responses (4xx, 5xx)
      const fetchError = err as { data?: PinAuthResponse; statusCode?: number };

      if (fetchError.data?.locked) {
        return {
          success: false,
          error: fetchError.data.error ?? "Cuenta bloqueada",
          locked: true,
        };
      }

      if (fetchError.data?.error) {
        return { success: false, error: fetchError.data.error };
      }

      return { success: false, error: "Error de conexión con el servidor" };
    }
  }

  /**
   * Verify the owner's PIN for restricted actions
   * (e.g., void a sale, apply large discount).
   *
   * @returns true if the PIN is correct, false otherwise.
   */
  async function verifyOwnerPin(pin: string): Promise<boolean> {
    try {
      const result = await $api<OwnerPinResponse>("/api/verify-owner-pin", {
        method: "POST",
        body: { pin },
      });

      return result.verified === true;
    } catch {
      return false;
    }
  }

  /**
   * Resolve the Nova user from the backend after Clerk login.
   *
   * Calls GET /api/me with the Clerk JWT to look up the user in
   * Nova's database. If the user exists, sets the NovaUser state.
   *
   * @returns Object with the resolved user, or an error code:
   *   - "ok": user resolved successfully
   *   - "not_found": Clerk user has no Nova account (needs onboarding)
   *   - "error": network or server error
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
        return { status: "ok" };
      }

      return { status: "error" };
    } catch (err) {
      const fetchError = err as {
        statusCode?: number;
        data?: { code?: string };
      };

      // 404 with USER_NOT_FOUND means Clerk user hasn't onboarded
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
   *
   * Removes the active user session but keeps nova:businessId in
   * localStorage so the PIN screen still works on this device.
   * This matches the Square pattern: the device stays bound to the
   * business even when no user is actively logged in.
   */
  function clearUser() {
    novaUser.value = null;
    if (import.meta.client) {
      localStorage.removeItem("nova:user");
      // Intentionally NOT removing nova:businessId -- the device
      // stays bound to the business for PIN-based access.
    }
  }

  /**
   * Check if this device has been configured for a business.
   * Returns the stored businessId or null.
   *
   * Used by the global auth middleware to decide whether to show
   * the PIN screen (configured device) or the landing page (new device).
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
  };
}
