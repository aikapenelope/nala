/**
 * Client-only plugin for auth initialization.
 *
 * Auth state is managed by Clerk and resolved via /auth/resolve.
 * This plugin is kept as a hook point for future client-side
 * auth initialization needs (e.g., offline session restore).
 */

export default defineNuxtPlugin(() => {
  // No-op. Auth is handled by Clerk + /auth/resolve flow.
});
