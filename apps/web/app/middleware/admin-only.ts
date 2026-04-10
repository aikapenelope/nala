/**
 * Route middleware that restricts access to admin (owner) users.
 *
 * Apply to pages that employees should not see:
 * accounts, reports, accounting, settings.
 *
 * Usage in a page:
 *   definePageMeta({ middleware: ['admin-only'] })
 */

export default defineNuxtRouteMiddleware(() => {
  const { isAdmin } = useNovaAuth();

  if (!isAdmin.value) {
    return navigateTo("/");
  }
});
