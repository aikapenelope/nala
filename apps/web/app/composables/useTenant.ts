/**
 * Tenant detection composable.
 *
 * Provides the current tenant slug extracted from the subdomain.
 * Works in both SSR (reads from Nitro event context via useRequestEvent)
 * and client-side (parses window.location.hostname).
 *
 * Usage:
 *   const { tenantSlug, hasTenant, tenantUrl } = useTenant();
 *   if (hasTenant.value) {
 *     console.log(`Tenant: ${tenantSlug.value}`);
 *   }
 */

/** Subdomains that are NOT tenant slugs (must match server middleware). */
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "mail",
  "ftp",
  "staging",
  "dev",
]);

export function useTenant() {
  const config = useRuntimeConfig();
  const tenantDomain = config.public.tenantDomain as string;

  const tenantSlug = useState<string | null>("tenant-slug", () => {
    // SSR: read from Nitro event context (set by server/middleware/tenant.ts)
    if (import.meta.server) {
      const event = useRequestEvent();
      return (event?.context?.tenantSlug as string) ?? null;
    }
    return null;
  });

  // Client-side: parse hostname on mount if not already set from SSR
  if (import.meta.client && tenantSlug.value === null) {
    const hostname = window.location.hostname;
    if (hostname.endsWith(`.${tenantDomain}`)) {
      const prefix = hostname.slice(0, -(tenantDomain.length + 1));
      if (prefix && !prefix.includes(".") && !RESERVED_SUBDOMAINS.has(prefix)) {
        tenantSlug.value = prefix;
      }
    }
  }

  const hasTenant = computed(() => tenantSlug.value !== null);

  /** Full tenant URL (e.g., "https://bodegadonpedro.novaincs.com"). */
  const tenantUrl = computed(() => {
    if (!tenantSlug.value) return null;
    return `https://${tenantSlug.value}.${tenantDomain}`;
  });

  return {
    tenantSlug: readonly(tenantSlug),
    hasTenant,
    tenantUrl,
  };
}
