/**
 * PWA update detection composable.
 *
 * Detects when a new version of the app is available (Service Worker updated)
 * and provides a reactive flag + refresh function for the UI to show a
 * non-intrusive update banner.
 *
 * How it works:
 * 1. On page load, checks if there's a waiting Service Worker (new version ready)
 * 2. Listens for the 'controllerchange' event (SW took over)
 * 3. When detected, sets `updateAvailable = true`
 * 4. UI shows a toast/banner with "Actualizar" button
 * 5. User taps → page reloads with the new version
 *
 * With registerType: "autoUpdate", the SW installs automatically.
 * This composable just handles the UX of notifying the user.
 */

export function usePwaUpdate() {
  const updateAvailable = ref(false);

  if (import.meta.client && "serviceWorker" in navigator) {
    // Check if there's already a waiting worker (update downloaded but not active)
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        updateAvailable.value = true;
      }

      // Listen for new updates that arrive while the page is open
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          // New SW installed and waiting to activate
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            updateAvailable.value = true;
          }
        });
      });
    });

    // If the controller changes (new SW activated), reload to get fresh assets
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  /** Trigger the update: tell the waiting SW to take over, then reload. */
  function applyUpdate() {
    if (!import.meta.client || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        // Tell the waiting SW to skip waiting and activate
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    });
  }

  return {
    updateAvailable: readonly(updateAvailable),
    applyUpdate,
  };
}
