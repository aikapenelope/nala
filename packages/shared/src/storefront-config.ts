/**
 * Storefront configuration.
 *
 * Single universal config for all business types.
 * Following Treinta.co's model: one product, one UI, for everyone.
 *
 * The business type only affects POS categories (set during onboarding).
 * The storefront looks and works the same for all businesses.
 */

/** Product card layout variant. */
export type CardLayout = "visual";

/** Checkout flow mode. */
export type CheckoutMode = "cart";

/** Storefront configuration (single universal config). */
export interface StorefrontConfig {
  cardLayout: CardLayout;
  showCarousel: boolean;
  showSku: boolean;
  showBrand: boolean;
  showDescription: boolean;
  ctaText: string;
  checkoutMode: CheckoutMode;
  showOutOfStock: boolean;
  gridCols: 2;
  imageAspect: "aspect-[4/5]";
}

/** The one and only storefront config. Same for all business types. */
const UNIVERSAL_CONFIG: StorefrontConfig = {
  cardLayout: "visual",
  showCarousel: true,
  showSku: false,
  showBrand: false,
  showDescription: true,
  ctaText: "Agregar",
  checkoutMode: "cart",
  showOutOfStock: true,
  gridCols: 2,
  imageAspect: "aspect-[4/5]",
};

/**
 * Get the storefront configuration.
 *
 * Always returns the same universal config regardless of business type.
 * The parameter is kept for backward compatibility but ignored.
 */
export function getStorefrontConfig(
  _businessType?: string | null,
): StorefrontConfig {
  return UNIVERSAL_CONFIG;
}
