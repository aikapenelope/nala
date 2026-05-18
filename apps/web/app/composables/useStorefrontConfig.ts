/**
 * Storefront configuration composable.
 *
 * Returns the universal StorefrontConfig. The config is the same
 * for all business types (single product, single UI).
 *
 * Usage:
 *   const { config } = useStorefrontConfig();
 */

import { getStorefrontConfig } from "@nova/shared";
import type { StorefrontConfig } from "@nova/shared";

export function useStorefrontConfig() {
  const { business } = useStorefront();

  const config = computed<StorefrontConfig>(() =>
    getStorefrontConfig(business.value?.type),
  );

  return {
    config: readonly(config),
  };
}
