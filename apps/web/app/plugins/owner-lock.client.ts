/**
 * Client plugin: initialize Owner Lock status on app load.
 *
 * This runs on every client-side app initialization (including page
 * reloads). It ensures:
 * 1. The lock status is fetched from the server (enabled or not)
 * 2. The unlock state is reset to false (locked by default on every
 *    page load — the user must enter the PIN again after reload)
 *
 * Without this plugin, the lock status would only be checked during
 * the auth/resolve flow (first login), and useState would persist
 * the "unlocked" state from the previous session.
 */
export default defineNuxtPlugin(async () => {
  if (!import.meta.client) return;

  // Wait for Nova user to be available (set by auth/resolve or hydrated)
  const novaUser = useState("nova-user");
  if (!novaUser.value) return;

  // Reset unlock state on every app initialization.
  // This ensures that a page reload always locks the app again.
  const unlocked = useState<boolean>("owner-lock-unlocked");
  unlocked.value = false;

  // Fetch lock enabled status from server
  const { checkStatus } = useOwnerLock();
  await checkStatus();
});
