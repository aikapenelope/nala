/**
 * Storefront configuration composable.
 *
 * Reads the business type from useStorefront() and returns the
 * resolved StorefrontConfig for the current tenant. The config
 * drives card layout, CTA text, checkout mode, and field visibility.
 *
 * Usage:
 *   const { config } = useStorefrontConfig();
 *   // config.value.cardLayout → "visual" | "compact" | "list"
 *   // config.value.ctaText → "Agregar" | "Pedir" | "Reservar" | ...
 */

import { getStorefrontConfig } from "@nova/shared";
import type { StorefrontConfig } from "@nova/shared";

export function useStorefrontConfig() {
  const { business } = useStorefront();

  /** Resolved config based on business.type, reactive to business changes. */
  const config = computed<StorefrontConfig>(() =>
    getStorefrontConfig(business.value?.type),
  );

  /** Whether the storefront uses a full cart checkout flow. */
  const isCartMode = computed(() => config.value.checkoutMode === "cart");

  /** Whether the storefront uses WhatsApp-direct ordering (no cart). */
  const isWhatsAppMode = computed(() => config.value.checkoutMode === "whatsapp");

  return {
    config: readonly(config),
    isCartMode: readonly(isCartMode),
    isWhatsAppMode: readonly(isWhatsAppMode),
  };
}
