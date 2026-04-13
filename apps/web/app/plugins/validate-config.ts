/**
 * Validate critical runtime config on app startup.
 *
 * If NUXT_PUBLIC_API_BASE is missing or still points to localhost
 * in production, log a clear error so the misconfiguration is
 * caught immediately instead of failing silently on API calls.
 */

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase as string;

  if (!apiBase) {
    console.error(
      "[config] FATAL: NUXT_PUBLIC_API_BASE is not set. API calls will fail.",
    );
    return;
  }

  // Warn if pointing to localhost in a non-dev build (SSR or client).
  if (
    apiBase.includes("localhost") &&
    process.env.NODE_ENV === "production"
  ) {
    console.error(
      `[config] WARNING: NUXT_PUBLIC_API_BASE is "${apiBase}". ` +
        "This looks like a development URL running in production. " +
        "Set NUXT_PUBLIC_API_BASE to the real API URL.",
    );
  }
});
