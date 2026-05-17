/**
 * Push notifications composable.
 *
 * Manages Web Push subscription lifecycle:
 * - Check if push is supported and permission status
 * - Subscribe/unsubscribe to push notifications
 * - Persist subscription to the API
 *
 * Usage:
 *   const { isSupported, permission, isSubscribed, subscribe, unsubscribe } = usePushNotifications();
 */

export function usePushNotifications() {
  const { $api } = useApi();

  const isSupported = ref(false);
  const permission = ref<NotificationPermission>("default");
  const isSubscribed = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /** Check if push notifications are supported in this browser. */
  function checkSupport() {
    if (!import.meta.client) return;
    isSupported.value =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    permission.value = isSupported.value ? Notification.permission : "denied";
  }

  /** Check if there's an active push subscription. */
  async function checkSubscription() {
    if (!import.meta.client || !isSupported.value) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      isSubscribed.value = !!sub;
    } catch {
      isSubscribed.value = false;
    }
  }

  /**
   * Subscribe to push notifications.
   *
   * 1. Request notification permission
   * 2. Get VAPID public key from API
   * 3. Subscribe via PushManager
   * 4. Send subscription to API for storage
   */
  async function subscribe(): Promise<boolean> {
    if (!import.meta.client || !isSupported.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      permission.value = perm;

      if (perm !== "granted") {
        error.value = "Permiso de notificaciones denegado";
        return false;
      }

      // Get VAPID public key
      const { vapidPublicKey } = await $api<{ vapidPublicKey: string }>(
        "/api/push/vapid-key",
      );

      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe via PushManager
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Send subscription to API
      await $api("/api/push/subscribe", {
        method: "POST",
        body: { subscription: subscription.toJSON() },
      });

      isSubscribed.value = true;
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error activando notificaciones";
      error.value = msg;
      console.error("[push] Subscribe error:", err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Unsubscribe from push notifications.
   *
   * 1. Unsubscribe via PushManager
   * 2. Remove subscription from API
   */
  async function unsubscribe(): Promise<boolean> {
    if (!import.meta.client || !isSupported.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Remove from API
        await $api("/api/push/subscribe", {
          method: "DELETE",
          body: { endpoint },
        });
      }

      isSubscribed.value = false;
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Error desactivando notificaciones";
      error.value = msg;
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // Initialize on client
  if (import.meta.client) {
    checkSupport();
    checkSubscription();
  }

  return {
    isSupported: readonly(isSupported),
    permission: readonly(permission),
    isSubscribed: readonly(isSubscribed),
    isLoading: readonly(isLoading),
    error: readonly(error),
    subscribe,
    unsubscribe,
  };
}

/**
 * Convert a base64-encoded VAPID key to a Uint8Array.
 * Required by PushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
