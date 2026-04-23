/**
 * Client-only plugin for auth initialization.
 *
 * With Clerk Organizations, auth state comes from Clerk's JWT,
 * not from localStorage. This plugin is kept as a placeholder
 * for any future client-side auth initialization needs.
 */

export default defineNuxtPlugin(() => {
  // Auth state is managed by Clerk and resolved via /auth/resolve.
  // No localStorage persistence needed with Organizations.
});
