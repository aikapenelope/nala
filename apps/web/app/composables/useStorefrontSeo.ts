/**
 * Storefront SEO composable.
 *
 * Sets dynamic meta tags, Open Graph, and manifest link
 * for storefront pages based on the current tenant's business data.
 *
 * Usage:
 *   useStorefrontSeo({ title: "Catalogo", description: "..." });
 */

interface StorefrontSeoOptions {
  /** Page-specific title suffix (e.g., "Catalogo", "Carrito"). */
  title?: string;
  /** Custom description override. */
  description?: string;
}

export function useStorefrontSeo(options: StorefrontSeoOptions = {}) {
  const { business } = useStorefront();
  const { tenantSlug } = useTenant();
  const config = useRuntimeConfig();
  const tenantDomain = config.public.tenantDomain as string;

  const pageTitle = computed(() => {
    const base = business.value?.name ?? "Tienda";
    return options.title ? `${options.title} - ${base}` : base;
  });

  const pageDescription = computed(() => {
    if (options.description) return options.description;
    return business.value
      ? `Tienda en linea de ${business.value.name}. Productos y precios actualizados.`
      : "Tienda en linea. Productos y precios actualizados.";
  });

  const canonicalUrl = computed(() => {
    if (!tenantSlug.value) return `https://${tenantDomain}`;
    return `https://${tenantSlug.value}.${tenantDomain}`;
  });

  useHead(
    computed(() => ({
      title: pageTitle.value,
      link: [
        { rel: "manifest", href: "/manifest.json" },
        { rel: "canonical", href: canonicalUrl.value },
      ],
      meta: [
        { name: "description", content: pageDescription.value },
        { name: "theme-color", content: "#111827", media: "(prefers-color-scheme: dark)" },
        { name: "theme-color", content: "#ffffff", media: "(prefers-color-scheme: light)" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        {
          name: "apple-mobile-web-app-status-bar-style",
          content: "black-translucent",
        },
        // Open Graph
        { property: "og:title", content: pageTitle.value },
        { property: "og:description", content: pageDescription.value },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonicalUrl.value },
        {
          property: "og:image",
          content: `https://${tenantDomain}/og-catalog.png`,
        },
        { property: "og:locale", content: "es_VE" },
        // Twitter
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: pageTitle.value },
        { name: "twitter:description", content: pageDescription.value },
      ],
    })),
  );
}
