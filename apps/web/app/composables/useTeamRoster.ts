/**
 * Team roster composable for local PIN verification.
 *
 * Downloads the employee roster from GET /api/team-roster (once, on owner login)
 * and caches it in localStorage. Provides verifyPin() that compares PINs
 * locally using bcrypt -- no API call needed for daily PIN entry.
 *
 * IMPORTANT: State is at module level (outside the function) so it's shared
 * across all components that call useTeamRoster(). This is critical because
 * the plugin loads the roster on app init, and the PIN screen needs to
 * read that same state.
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
const REFRESH_INTERVAL_MS = 1 * 60 * 1000; // 1 minute

// Module-level shared state -- same instance across all useTeamRoster() calls
const _roster = ref<RosterEntry[]>([]);
const _businessId = ref<string | null>(null);
const _businessName = ref<string | null>(null);
const _isLoaded = ref(false);
const _lastRefresh = ref<string | null>(null);
let _refreshInterval: ReturnType<typeof setInterval> | null = null;

export function useTeamRoster() {
  const { $api } = useApi();

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
      _roster.value = cached.roster;
      _businessId.value = cached.businessId;
      _businessName.value = cached.businessName;
      _lastRefresh.value = cached.generatedAt;
      _isLoaded.value = true;
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
      // Use silent mode to avoid triggering the session-expired banner.
      const result = await $api<CachedRoster>("/api/team-roster", {
        silent: true,
      });

      _roster.value = result.roster;
      _businessId.value = result.businessId;
      _businessName.value = result.businessName;
      _lastRefresh.value = result.generatedAt;
      _isLoaded.value = true;

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
   * Returns the matching user entry, or null if no match.
   */
  async function verifyPin(pin: string): Promise<RosterEntry | null> {
    for (const entry of _roster.value) {
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
    for (const entry of _roster.value) {
      if (entry.role !== "owner") continue;
      const match = await bcrypt.compare(pin, entry.pinHash);
      if (match) return entry;
    }
    return null;
  }

  /** Check if the roster has any entries (device is configured). */
  function hasRoster(): boolean {
    if (_isLoaded.value && _roster.value.length > 0) return true;
    if (import.meta.client) {
      return localStorage.getItem(STORAGE_KEY) !== null;
    }
    return false;
  }

  /**
   * Start periodic roster refresh (call once on app init).
   * Refreshes every 1 minute to pick up employee changes.
   */
  function startAutoRefresh() {
    if (!import.meta.client) return;

    // Prevent duplicate intervals
    if (_refreshInterval) clearInterval(_refreshInterval);

    _refreshInterval = setInterval(() => {
      if (_isLoaded.value) {
        refreshRoster();
      }
    }, REFRESH_INTERVAL_MS);
  }

  return {
    roster: readonly(_roster),
    businessId: readonly(_businessId),
    businessName: readonly(_businessName),
    isLoaded: readonly(_isLoaded),
    lastRefresh: readonly(_lastRefresh),
    loadFromCache,
    refreshRoster,
    verifyPin,
    verifyOwnerPin,
    hasRoster,
    startAutoRefresh,
  };
}
