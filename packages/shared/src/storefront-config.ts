/**
 * Storefront configuration per business type.
 *
 * Simplified to 3 profiles that cover all business verticals:
 * - "visual" (moda): large images, carousel, cart checkout
 * - "compact" (tienda, servicios, otro): dense info, WhatsApp or cart
 *
 * Legacy types (bodega, ropa, peluqueria, etc.) are mapped to the
 * appropriate profile so existing businesses keep working.
 */

/** Product card layout variant. */
export type CardLayout = "visual" | "compact";

/** Checkout flow mode. */
export type CheckoutMode = "cart" | "whatsapp";

/** Full storefront configuration. */
export interface StorefrontConfig {
  /** Product card layout variant. */
  cardLayout: CardLayout;
  /** Whether to show image carousel (multi-image swipe). */
  showCarousel: boolean;
  /** Whether to show SKU on the product card. */
  showSku: boolean;
  /** Whether to show brand name on the product card. */
  showBrand: boolean;
  /** Whether to show product description on the card. */
  showDescription: boolean;
  /** CTA button text on the product card. */
  ctaText: string;
  /** Checkout flow mode: full cart or WhatsApp direct. */
  checkoutMode: CheckoutMode;
  /** Whether to show out-of-stock products (grayed out). */
  showOutOfStock: boolean;
  /** Grid columns on mobile (1 or 2). */
  gridCols: 1 | 2;
  /** Product image aspect ratio CSS class. */
  imageAspect: "aspect-[4/5]" | "aspect-square";
}

/** Config profile for "tienda" (bodega, mini-market, tienda de barrio). */
const TIENDA_CONFIG: StorefrontConfig = {
  cardLayout: "compact",
  showCarousel: false,
  showSku: false,
  showBrand: false,
  showDescription: false,
  ctaText: "Pedir",
  checkoutMode: "whatsapp",
  showOutOfStock: false,
  gridCols: 2,
  imageAspect: "aspect-square",
};

/** Config profile for "moda" (ropa, cosmeticos, accesorios). */
const MODA_CONFIG: StorefrontConfig = {
  cardLayout: "visual",
  showCarousel: true,
  showSku: false,
  showBrand: true,
  showDescription: true,
  ctaText: "Agregar",
  checkoutMode: "cart",
  showOutOfStock: true,
  gridCols: 2,
  imageAspect: "aspect-[4/5]",
};

/** Config profile for "servicios" (peluqueria, barberia, profesionales). */
const SERVICIOS_CONFIG: StorefrontConfig = {
  cardLayout: "compact",
  showCarousel: false,
  showSku: false,
  showBrand: false,
  showDescription: true,
  ctaText: "Reservar",
  checkoutMode: "whatsapp",
  showOutOfStock: false,
  gridCols: 1,
  imageAspect: "aspect-square",
};

/** Config profile for "otro" (default, everything else). */
const OTRO_CONFIG: StorefrontConfig = {
  cardLayout: "visual",
  showCarousel: true,
  showSku: false,
  showBrand: false,
  showDescription: false,
  ctaText: "Agregar",
  checkoutMode: "cart",
  showOutOfStock: true,
  gridCols: 2,
  imageAspect: "aspect-[4/5]",
};

/**
 * Map every business type (new + legacy) to a config profile.
 *
 * Legacy types are mapped to the closest new profile so existing
 * businesses get a reasonable storefront without any migration.
 */
const TYPE_TO_CONFIG: Record<string, StorefrontConfig> = {
  // Primary types
  tienda: TIENDA_CONFIG,
  moda: MODA_CONFIG,
  servicios: SERVICIOS_CONFIG,
  otro: OTRO_CONFIG,

  // Legacy -> mapped to closest profile
  bodega: TIENDA_CONFIG,
  farmacia: TIENDA_CONFIG,
  distribuidora: TIENDA_CONFIG,
  ferreteria: TIENDA_CONFIG,
  libreria: TIENDA_CONFIG,
  autopartes: TIENDA_CONFIG,
  ropa: MODA_CONFIG,
  cosmeticos: MODA_CONFIG,
  peluqueria: SERVICIOS_CONFIG,
  electronica: OTRO_CONFIG,
};

/**
 * Get the storefront configuration for a business type.
 *
 * Returns the mapped config profile, or OTRO_CONFIG if unknown.
 */
export function getStorefrontConfig(
  businessType: string | null | undefined,
): StorefrontConfig {
  return TYPE_TO_CONFIG[businessType ?? "otro"] ?? OTRO_CONFIG;
}
