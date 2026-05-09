/**
 * PWA install prompt composable.
 *
 * Captures the browser's `beforeinstallprompt` event and provides
 * a programmatic way to trigger the install dialog. Also detects
 * iOS Safari (which doesn't support beforeinstallprompt) and provides
 * manual install instructions.
 *
 * Usage:
 *   const { canInstall, isIos, install, dismiss, dismissed } = usePwaInstall();
 */

/**
 * The BeforeInstallPromptEvent is not yet in the standard lib types.
 * Chrome, Edge, and Samsung Internet fire this event when the PWA
 * meets installability criteria.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Key used to persist the user's dismissal in localStorage. */
const DISMISS_KEY = "nova-pwa-install-dismissed";

export function usePwaInstall() {
  const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);

  /** True when the browser has offered an installable PWA. */
  const canInstall = computed(() => deferredPrompt.value !== null);

  /** True when running on iOS Safari (no beforeinstallprompt support). */
  const isIos = ref(false);

  /** True when the user has already been shown the banner and dismissed it. */
  const dismissed = ref(false);

  /** True when the app is already installed (standalone mode). */
  const isStandalone = ref(false);

  if (import.meta.client) {
    // Detect iOS Safari
    const ua = navigator.userAgent;
    isIos.value =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    // Detect if already running as installed PWA
    isStandalone.value =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as unknown as { standalone: boolean }).standalone === true);

    // Check if user previously dismissed the banner
    try {
      dismissed.value = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // localStorage unavailable
    }

    // Listen for the install prompt event
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt.value = e as BeforeInstallPromptEvent;
    });

    // Clear prompt if app gets installed
    window.addEventListener("appinstalled", () => {
      deferredPrompt.value = null;
      isStandalone.value = true;
    });
  }

  /** Trigger the native install dialog. */
  async function install(): Promise<boolean> {
    if (!deferredPrompt.value) return false;

    await deferredPrompt.value.prompt();
    const { outcome } = await deferredPrompt.value.userChoice;
    deferredPrompt.value = null;

    return outcome === "accepted";
  }

  /** Dismiss the install banner (persists in localStorage). */
  function dismiss() {
    dismissed.value = true;
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage unavailable
    }
  }

  /** Whether to show the install banner. */
  const showBanner = computed(() => {
    if (isStandalone.value) return false;
    if (dismissed.value) return false;
    return canInstall.value || isIos.value;
  });

  return {
    canInstall: readonly(canInstall),
    isIos: readonly(isIos),
    isStandalone: readonly(isStandalone),
    dismissed: readonly(dismissed),
    showBanner,
    install,
    dismiss,
  };
}
