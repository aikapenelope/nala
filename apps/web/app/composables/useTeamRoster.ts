/**
 * Team roster composable for local PIN verification.
 *
 * Downloads the employee roster from GET /api/team-roster (once, on owner login)
 * and caches it in localStorage. Provides verifyPin() that compares PINs
 * locally using bcrypt -- no API call needed for daily PIN entry.
 *
 * This implements the "PIN is identification, not authentication" pattern
 * from AUTH-REFACTOR-PLAN.md. The Clerk JWT authenticates the device;
 * the PIN only identifies which employee is using it.
 *
 * Cache refresh: every 5 minutes while the app is open, or manually
 * via refreshRoster(). The roster is also refreshed when an employee
 * is added/edited (future Sprint D).
 */

import bcrypt from "bcryptjs";

/** A cached team member with PIN hash for local verification. */
export interface RosterEntry {
  id: string;
  name: string;
  role: string;
  pinHash: string;
}

/** Shape of the cached roster in localStorage. */
interface CachedRoster {
  roster: RosterEntry[];
  businessId: string;
  businessName: string;
  generatedAt: string;
}

const STORAGE_KEY = "nova:team-roster";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useTeamRoster() {
  const { $api } = useApi();

  const roster = ref<RosterEntry[]>([]);
  const businessId = ref<string | null>(null);
  const businessName = ref<string | null>(null);
  const isLoaded = ref(false);
  const lastRefresh = ref<string | null>(null);

  /**
   * Load roster from localStorage cache.
   * Returns true if a cached roster was found.
   */
  function loadFromCache(): boolean {
    if (!import.meta.client) return false;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    try {
      const cached = JSON.parse(stored) as CachedRoster;
      roster.value = cached.roster;
      businessId.value = cached.businessId;
      businessName.value = cached.businessName;
      lastRefresh.value = cached.generatedAt;
      isLoaded.value = true;
      return true;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
  }

  /**
   * Download fresh roster from the server and cache it.
   * Requires a valid Clerk JWT (only works when owner is signed in).
   */
  async function refreshRoster(): Promise<boolean> {
    try {
      const result = await $api<CachedRoster>("/api/team-roster");

      roster.value = result.roster;
      businessId.value = result.businessId;
      businessName.value = result.businessName;
      lastRefresh.value = result.generatedAt;
      isLoaded.value = true;

      if (import.meta.client) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      }

      return true;
    } catch {
      // If refresh fails (e.g., JWT expired), keep using cached roster
      return false;
    }
  }

  /**
   * Verify a PIN locally against the cached roster.
   *
   * Iterates all roster entries and compares the PIN hash using bcrypt.
   * Returns the matching user entry, or null if no match.
   *
   * This is the core of the refactor: PIN verification happens here
   * in the browser, not on the server. No API call is made.
   */
  async function verifyPin(pin: string): Promise<RosterEntry | null> {
    for (const entry of roster.value) {
      const match = await bcrypt.compare(pin, entry.pinHash);
      if (match) return entry;
    }
    return null;
  }

  /**
   * Verify an owner PIN locally (for restricted actions like void sale).
   * Only checks roster entries with role "owner".
   */
  async function verifyOwnerPin(pin: string): Promise<RosterEntry | null> {
    for (const entry of roster.value) {
      if (entry.role !== "owner") continue;
      const match = await bcrypt.compare(pin, entry.pinHash);
      if (match) return entry;
    }
    return null;
  }

  /** Check if the roster has any entries (device is configured). */
  function hasRoster(): boolean {
    if (import.meta.client) {
      return localStorage.getItem(STORAGE_KEY) !== null;
    }
    return roster.value.length > 0;
  }

  /**
   * Start periodic roster refresh (call once on app init).
   * Refreshes every 5 minutes to pick up employee changes.
   */
  function startAutoRefresh() {
    if (!import.meta.client) return;

    setInterval(() => {
      // Only refresh if we have a roster (device is configured)
      if (isLoaded.value) {
        refreshRoster();
      }
    }, REFRESH_INTERVAL_MS);
  }

  return {
    roster: readonly(roster),
    businessId: readonly(businessId),
    businessName: readonly(businessName),
    isLoaded: readonly(isLoaded),
    lastRefresh: readonly(lastRefresh),
    loadFromCache,
    refreshRoster,
    verifyPin,
    verifyOwnerPin,
    hasRoster,
    startAutoRefresh,
  };
}
