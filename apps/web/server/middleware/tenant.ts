/**
 * Nitro server middleware for tenant detection via subdomain.
 *
 * Parses the Host header to extract a tenant slug from the subdomain.
 * Sets `event.context.tenantSlug` for downstream use in SSR and API routes.
 *
 * Examples:
 *   bodegadonpedro.novaincs.com -> tenantSlug = "bodegadonpedro"
 *   novaincs.com                -> tenantSlug = null (main site)
 *   www.novaincs.com            -> tenantSlug = null (ignored)
 *   localhost:3000                   -> tenantSlug = null (dev, no subdomain)
 *   bodega.localhost:3000            -> tenantSlug = "bodega" (dev with /etc/hosts)
 *
 * The tenant domain is configurable via NUXT_PUBLIC_TENANT_DOMAIN env var.
 * Default: "novaincs.com" in production, "localhost" in development.
 */

import { getRequestHeader, defineEventHandler } from "h3";

/** Subdomains that are NOT tenant slugs. */
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "mail",
  "ftp",
  "staging",
  "dev",
]);

export default defineEventHandler((event) => {
  const host = getRequestHeader(event, "host") ?? "";

  // Strip port for matching (e.g., "bodega.localhost:3000" -> "bodega.localhost")
  const hostname = host.split(":")[0] ?? "";

  // Try to extract tenant slug from subdomain.
  // Pattern: {slug}.{tenantDomain}
  // tenantDomain can be "novaincs.com" or "localhost" (dev)
  const tenantDomain =
    process.env.NUXT_PUBLIC_TENANT_DOMAIN ?? "novaincs.com";

  let tenantSlug: string | null = null;

  if (hostname.endsWith(`.${tenantDomain}`)) {
    // Extract everything before the tenant domain
    const prefix = hostname.slice(0, -(tenantDomain.length + 1));

    // Only accept simple slugs (no dots, no reserved names)
    if (prefix && !prefix.includes(".") && !RESERVED_SUBDOMAINS.has(prefix)) {
      tenantSlug = prefix;
    }
  }

  // Set on event context for SSR pages and Nuxt server routes
  event.context.tenantSlug = tenantSlug;
});
