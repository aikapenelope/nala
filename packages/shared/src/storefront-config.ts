/**
 * Storefront configuration per business type.
 *
 * Defines how the public storefront adapts its UI based on the
 * business vertical (bodega, ropa, ferreteria, etc.).
 *
 * The catalog page reads business.type from the API and uses
 * these defaults to decide: card layout, CTA text, checkout mode,
 * which product fields to show, and sort order.
 *
 * Business owners can override these defaults from /store settings
 * (future: storefront_config column in store_settings).
 */

import type { BusinessType } from "./types";

/** Product card layout variant. */
export type CardLayout = "visual" | "compact" | "list";

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
  imageAspect: "aspect-[4/5]" | "aspect-square" | "aspect-video";
}

/** Default config used as base for all business types. */
const BASE_CONFIG: StorefrontConfig = {
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
 * Storefront config overrides per business type.
 *
 * Only the fields that differ from BASE_CONFIG are specified.
 * The composable merges these with the base to produce the final config.
 */
const OVERRIDES: Partial<Record<BusinessType, Partial<StorefrontConfig>>> = {
  bodega: {
    cardLayout: "compact",
    showCarousel: false,
    ctaText: "Pedir",
    checkoutMode: "whatsapp",
    showOutOfStock: false,
    imageAspect: "aspect-square",
  },
  ropa: {
    cardLayout: "visual",
    showCarousel: true,
    showDescription: true,
    ctaText: "Agregar",
    checkoutMode: "cart",
    imageAspect: "aspect-[4/5]",
  },
  ferreteria: {
    cardLayout: "compact",
    showSku: true,
    showBrand: true,
    ctaText: "Consultar",
    checkoutMode: "whatsapp",
    imageAspect: "aspect-square",
  },
  autopartes: {
    cardLayout: "compact",
    showSku: true,
    showBrand: true,
    ctaText: "Consultar",
    checkoutMode: "whatsapp",
    imageAspect: "aspect-square",
  },
  peluqueria: {
    cardLayout: "list",
    showCarousel: false,
    showDescription: true,
    ctaText: "Reservar",
    checkoutMode: "whatsapp",
    showOutOfStock: false,
    gridCols: 1,
    imageAspect: "aspect-square",
  },
  farmacia: {
    cardLayout: "compact",
    showCarousel: false,
    showBrand: true,
    ctaText: "Pedir",
    checkoutMode: "whatsapp",
    showOutOfStock: false,
    imageAspect: "aspect-square",
  },
  electronica: {
    cardLayout: "visual",
    showCarousel: true,
    showBrand: true,
    ctaText: "Agregar",
    checkoutMode: "cart",
    imageAspect: "aspect-[4/5]",
  },
  libreria: {
    cardLayout: "compact",
    showCarousel: false,
    ctaText: "Agregar",
    checkoutMode: "cart",
    imageAspect: "aspect-square",
  },
  cosmeticos: {
    cardLayout: "visual",
    showCarousel: true,
    showBrand: true,
    showDescription: true,
    ctaText: "Agregar",
    checkoutMode: "cart",
    imageAspect: "aspect-[4/5]",
  },
  distribuidora: {
    cardLayout: "list",
    showCarousel: false,
    showSku: true,
    ctaText: "Cotizar",
    checkoutMode: "whatsapp",
    gridCols: 1,
    imageAspect: "aspect-square",
  },
  otro: {
    // Uses BASE_CONFIG as-is
  },
};

/**
 * Get the storefront configuration for a business type.
 *
 * Merges the base config with type-specific overrides.
 * Returns the full BASE_CONFIG if the type is unknown.
 */
export function getStorefrontConfig(
  businessType: string | null | undefined,
): StorefrontConfig {
  const overrides = OVERRIDES[(businessType ?? "otro") as BusinessType] ?? {};
  return { ...BASE_CONFIG, ...overrides };
}
