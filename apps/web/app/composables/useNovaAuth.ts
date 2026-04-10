/**
 * Nova authentication composable.
 *
 * Wraps Clerk auth (for owners) and PIN auth (for employees)
 * into a unified interface. Provides:
 * - Current user info (name, role, businessId)
 * - isAdmin / isEmployee computed flags
 * - PIN-based user switching for shared devices
 * - Owner PIN verification for restricted actions
 */

import type { UserRole } from "@nova/shared";

/** Nova user as seen by the frontend. */
export interface NovaUser {
  id: string;
  name: string;
  role: UserRole;
  businessId: string;
  clerkId?: string;
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

  /**
   * Set the current Nova user after Clerk login or PIN entry.
   * Called by the onboarding flow or PIN screen.
   */
  function setUser(user: NovaUser) {
    novaUser.value = user;
  }

  /**
   * Switch to a different user via PIN (shared device).
   * Does not log out of Clerk -- the device session stays active.
   */
  async function switchUser(pin: string): Promise<boolean> {
    // TODO (Sprint 1.3): Call API to verify PIN and get user
    console.log("PIN switch requested:", pin);
    return false;
  }

  /**
   * Verify the owner's PIN for restricted actions
   * (e.g., void a sale, apply large discount).
   */
  async function verifyOwnerPin(pin: string): Promise<boolean> {
    // TODO (Sprint 1.3): Call API to verify owner PIN
    console.log("Owner PIN verification requested:", pin);
    return false;
  }

  /** Clear the current user (logout). */
  function clearUser() {
    novaUser.value = null;
  }

  return {
    user: readonly(novaUser),
    isAuthenticated,
    isAdmin,
    isEmployee,
    setUser,
    switchUser,
    verifyOwnerPin,
    clearUser,
  };
}
