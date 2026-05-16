/**
 * Client plugin: initialize Owner Lock status on app load.
 *
 * This runs on every client-side app initialization (including page
 * reloads). It checks whether the owner lock is enabled so that
 * OwnerLockGuard components know whether to show the lock overlay.
 *
 * Without this plugin, the lock status would only be checked during
 * the auth/resolve flow (first login), and page reloads would reset
 * the state to "not checked" which defaults to unlocked.
 *
 * The plugin waits for the Nova user to be resolved before checking,
 * because the API requires authentication.
 */
export default defineNuxtPlugin(async () => {
  // Only run on client
  if (!import.meta.client) return;

  // Wait for Nova user to be available (set by auth/resolve or hydrated)
  const novaUser = useState("nova-user");
  if (!novaUser.value) return;

  // Check lock status
  const { checkStatus } = useOwnerLock();
  await checkStatus();
});
