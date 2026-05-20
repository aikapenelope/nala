/**
 * Global owner-lock middleware.
 *
 * Prevents navigation to protected routes when the owner lock is active.
 * Runs BEFORE the page component mounts, eliminating:
 * - Content flash (page never renders if locked)
 * - Duplicate redirects (single redirect point vs. per-page onMounted)
 * - KeepAlive destruction (layout slot is never conditionally hidden)
 *
 * The lock status is initialized lazily on first encounter with a
 * protected route. Subsequent navigations read cached module-level state.
 *
 * Naming: "owner-lock" sorts after "auth" alphabetically, ensuring
 * the user is authenticated before we check the lock.
 */

import { LOCKED_ROUTES } from "~/utils/locked-routes";

export default defineNuxtRouteMiddleware(async (to) => {
  // Only run on client — lock is a client-side UX feature
  if (!import.meta.client) return;

  // Skip if navigating to the unlock page itself (avoid redirect loop)
  if (to.path === "/unlock") return;

  // Check if the target route is protected
  const isProtected = LOCKED_ROUTES.some(
    (r) => to.path === r || to.path.startsWith(r + "/"),
  );

  if (!isProtected) return;

  // Read lock state — ensureInitialized() is idempotent and cached.
  // If Clerk isn't loaded yet, ensureInitialized() returns without
  // marking statusChecked=true. In that case, isLocked is true (fail-closed)
  // but we allow navigation — the auth middleware already handles the
  // "Clerk not loaded" case, and on next navigation we'll retry.
  const { isLocked, isReady, ensureInitialized } = useOwnerLock();

  await ensureInitialized();

  // If status couldn't be determined (Clerk not loaded), allow through.
  // The fail-closed default would block ALL routes which is too aggressive.
  if (!isReady.value) return;

  if (isLocked.value) {
    return navigateTo({
      path: "/unlock",
      query: { redirect: to.fullPath },
    }, { replace: true });
  }
});
