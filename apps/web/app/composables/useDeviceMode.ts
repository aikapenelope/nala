/**
 * Device mode composable.
 *
 * Manages whether this device operates in "owner" mode (admin's personal
 * device) or "store" mode (shared PC at the shop counter).
 *
 * Also tracks when the device was activated (Clerk login) and enforces
 * a 30-day expiry. After 30 days, the owner must re-login with Clerk.
 *
 * The mode and activation date are persisted in localStorage.
 */

export type DeviceMode = "owner" | "store";

const MODE_KEY = "nova:device-mode";
const ACTIVATED_KEY = "nova:device-activated-at";
const EXPIRY_DAYS = 30;

const _mode = ref<DeviceMode>("owner");
const _activatedAt = ref<Date | null>(null);

export function useDeviceMode() {
  /** Read mode and activation date from localStorage. */
  function init() {
    if (!import.meta.client) return;
    const stored = localStorage.getItem(MODE_KEY);
    _mode.value = stored === "store" ? "store" : "owner";

    const activatedStr = localStorage.getItem(ACTIVATED_KEY);
    if (activatedStr) {
      _activatedAt.value = new Date(activatedStr);
    }
  }

  /** Record device activation (called after successful Clerk login). */
  function markActivated() {
    const now = new Date();
    _activatedAt.value = now;
    if (import.meta.client) {
      localStorage.setItem(ACTIVATED_KEY, now.toISOString());
    }
  }

  /** Activate store mode (shared PC at the counter). */
  function activateStoreMode() {
    _mode.value = "store";
    if (import.meta.client) {
      localStorage.setItem(MODE_KEY, "store");
    }
  }

  /** Deactivate store mode (back to owner's personal device). */
  function deactivateStoreMode() {
    _mode.value = "owner";
    if (import.meta.client) {
      localStorage.setItem(MODE_KEY, "owner");
    }
  }

  const isStoreMode = computed(() => _mode.value === "store");
  const isOwnerMode = computed(() => _mode.value === "owner");

  /** Days remaining before the device session expires. */
  const daysRemaining = computed(() => {
    if (!_activatedAt.value) return null;
    const elapsed = Date.now() - _activatedAt.value.getTime();
    const remaining = EXPIRY_DAYS - Math.floor(elapsed / (1000 * 60 * 60 * 24));
    return Math.max(remaining, 0);
  });

  /** Whether the device session has expired (30+ days since activation). */
  const isExpired = computed(() => {
    if (daysRemaining.value === null) return false;
    return daysRemaining.value <= 0;
  });

  /** Formatted activation date for display. */
  const activatedAtFormatted = computed(() => {
    if (!_activatedAt.value) return null;
    return _activatedAt.value.toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  });

  return {
    mode: readonly(_mode),
    isStoreMode,
    isOwnerMode,
    activatedAt: readonly(_activatedAt),
    activatedAtFormatted,
    daysRemaining,
    isExpired,
    init,
    markActivated,
    activateStoreMode,
    deactivateStoreMode,
  };
}
