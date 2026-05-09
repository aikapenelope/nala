/**
 * Storefront redirect middleware.
 *
 * When a tenant subdomain is detected (e.g., bodega.novaincs.com),
 * redirects the root path `/` to `/tienda` so the customer sees
 * the store catalog instead of the dashboard landing page.
 *
 * Only redirects `/` — other paths like `/tienda/cart` pass through.
 * Runs after auth.global.ts (alphabetical order: "s" > "a").
 */

export default defineNuxtRouteMiddleware((to) => {
  const { hasTenant } = useTenant();

  if (!hasTenant.value) {
    return;
  }

  // If on root path and tenant is active, redirect to storefront
  if (to.path === "/" || to.path === "") {
    return navigateTo("/tienda", { redirectCode: 302 });
  }

  // Block access to dashboard routes when on a tenant subdomain
  const storefrontPaths = ["/tienda", "/catalogo"];
  const isStorefrontRoute = storefrontPaths.some((p) => to.path.startsWith(p));

  if (!isStorefrontRoute && to.path !== "/") {
    return navigateTo("/tienda", { redirectCode: 302 });
  }
});
