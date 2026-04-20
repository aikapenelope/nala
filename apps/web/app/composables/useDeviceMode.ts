/**
 * Device mode composable.
 *
 * Manages whether this device operates in "owner" mode (admin's personal
 * device) or "store" mode (shared tablet/PC at the shop counter).
 *
 * Owner mode:
 *   - The owner is always admin. No PIN screen, no user switching.
 *   - Clerk session = admin session. If Clerk expires, re-login.
 *
 * Store mode:
 *   - The device shows only the PIN screen after initial setup.
 *   - Employees enter their PIN to identify themselves.
 *   - The owner can also enter their PIN to get admin access.
 *   - Clerk JWT stays active in the background (for API calls).
 *   - "Switch user" goes back to PIN screen (change shift).
 *
 * The mode is persisted in localStorage and survives page reloads.
 * Default is "owner" (personal device) until explicitly set to "store".
 */

export type DeviceMode = "owner" | "store";

const STORAGE_KEY = "nova:device-mode";

const _mode = ref<DeviceMode>("owner");

export function useDeviceMode() {
  /** Read mode from localStorage on first call. */
  function init() {
    if (!import.meta.client) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "store") {
      _mode.value = "store";
    } else {
      _mode.value = "owner";
    }
  }

  /** Activate store mode (shared device at the counter). */
  function activateStoreMode() {
    _mode.value = "store";
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, "store");
    }
  }

  /** Deactivate store mode (back to owner's personal device). */
  function deactivateStoreMode() {
    _mode.value = "owner";
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, "owner");
    }
  }

  const isStoreMode = computed(() => _mode.value === "store");
  const isOwnerMode = computed(() => _mode.value === "owner");

  return {
    mode: readonly(_mode),
    isStoreMode,
    isOwnerMode,
    init,
    activateStoreMode,
    deactivateStoreMode,
  };
}
