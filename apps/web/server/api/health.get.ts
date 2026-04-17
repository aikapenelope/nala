/**
 * Nuxt SSR health check endpoint.
 *
 * Returns 200 if the Nuxt server is running and can handle requests.
 * Used by the Docker HEALTHCHECK and external monitoring (Uptime Kuma).
 *
 * Unlike the API's /health endpoint, this only checks that SSR is alive.
 * It does not check database or Redis (those are the API's responsibility).
 */

export default defineEventHandler(() => {
  return {
    status: "ok",
    service: "nova-web",
    timestamp: new Date().toISOString(),
  };
});
