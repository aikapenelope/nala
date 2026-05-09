/**
 * Dynamic PWA manifest per tenant.
 *
 * When accessed from a tenant subdomain (e.g., bodega.novaincs.com/manifest.json),
 * returns a manifest customized with the business name and branding.
 * When accessed from the main domain, returns the default Nova manifest.
 *
 * This enables each storefront to be installable as a separate PWA
 * with its own icon on the customer's home screen.
 */

import { defineEventHandler, setResponseHeader } from "h3";

export default defineEventHandler((event) => {
  const tenantSlug = event.context.tenantSlug as string | null;

  setResponseHeader(event, "content-type", "application/manifest+json");

  // Default manifest for the main Nova app
  if (!tenantSlug) {
    return {
      name: "Nova - Backoffice Operativo",
      short_name: "Nova",
      description:
        "Backoffice operativo para comerciantes y PyMEs. Ventas, inventario, clientes, reportes.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: "#1e40af",
      background_color: "#ffffff",
      orientation: "any",
      icons: [
        { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
      ],
    };
  }

  // Tenant-specific manifest for the storefront PWA.
  // The business name will be resolved client-side via useStorefront;
  // here we use the slug as a fallback for the manifest name.
  const storeName = tenantSlug.charAt(0).toUpperCase() + tenantSlug.slice(1);

  return {
    name: `${storeName} - Tienda`,
    short_name: storeName.slice(0, 12),
    description: `Tienda en linea de ${storeName}. Productos, precios y pedidos.`,
    start_url: "/tienda",
    scope: "/",
    display: "standalone",
    theme_color: "#111827",
    background_color: "#f9fafb",
    orientation: "portrait",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    categories: ["shopping", "business"],
  };
});
