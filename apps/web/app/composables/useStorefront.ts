/**
 * Storefront data composable.
 *
 * Fetches catalog (products + business info) and store settings
 * from the public API for the current tenant slug.
 *
 * Usage:
 *   const { business, products, categories, storeInfo, isLoading, error, refresh } = useStorefront();
 */

export interface StorefrontProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryName: string | null;
  available: boolean;
}

export interface StorefrontBusiness {
  name: string;
  type: string;
  phone: string | null;
  address: string | null;
  slug: string;
  whatsappNumber: string | null;
}

export interface StorefrontCategory {
  id: string;
  name: string;
}

export interface PaymentMethodDetail {
  method: string;
  label: string;
  details: Record<string, string>;
}

export interface StoreInfo {
  storeEnabled: boolean;
  paymentMethods: PaymentMethodDetail[];
  deliveryEnabled: boolean;
  deliveryFee: number;
  deliveryZones: string | null;
  welcomeMessage: string | null;
  minOrderAmount: number;
}

/** Page size for paginated catalog requests. */
const CATALOG_PAGE_SIZE = 50;

export function useStorefront() {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase as string;
  const { tenantSlug } = useTenant();

  const business = useState<StorefrontBusiness | null>(
    "storefront-business",
    () => null,
  );
  const products = useState<StorefrontProduct[]>(
    "storefront-products",
    () => [],
  );
  const categories = useState<StorefrontCategory[]>(
    "storefront-categories",
    () => [],
  );
  const storeInfo = useState<StoreInfo | null>("storefront-info", () => null);
  const exchangeRate = useState<number | null>("storefront-rate", () => null);
  const isLoading = ref(false);
  const isLoadingMore = ref(false);
  const hasMore = ref(false);
  const error = ref<string | null>(null);

  /** Current pagination offset (tracks how many products have been loaded). */
  let currentOffset = 0;

  /** Fetch the first page of catalog data from the public API. */
  async function fetchCatalog() {
    if (!tenantSlug.value) {
      error.value = "No se detecto la tienda.";
      return;
    }

    isLoading.value = true;
    error.value = null;
    currentOffset = 0;

    try {
      const [catalogData, storeData] = await Promise.all([
        $fetch<{
          business: StorefrontBusiness;
          categories: StorefrontCategory[];
          products: StorefrontProduct[];
          exchangeRate: number | null;
          pagination?: { total: number; limit: number; offset: number; hasMore: boolean };
        }>(`${apiBase}/catalog/${tenantSlug.value}?limit=${CATALOG_PAGE_SIZE}&offset=0`),
        $fetch<StoreInfo>(`${apiBase}/catalog/${tenantSlug.value}/store-info`).catch(
          () => null,
        ),
      ]);

      business.value = catalogData.business;
      products.value = catalogData.products;
      categories.value = catalogData.categories;
      exchangeRate.value = catalogData.exchangeRate;
      storeInfo.value = storeData;
      hasMore.value = catalogData.pagination?.hasMore ?? false;
      currentOffset = catalogData.products.length;
    } catch {
      error.value = "No se pudo cargar la tienda. Verifica el enlace.";
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Fetch the next page of products and append to the existing list.
   * Returns false if there are no more products to load.
   */
  async function fetchMore(): Promise<boolean> {
    if (!tenantSlug.value || !hasMore.value || isLoadingMore.value) {
      return false;
    }

    isLoadingMore.value = true;

    try {
      const catalogData = await $fetch<{
        products: StorefrontProduct[];
        pagination?: { total: number; limit: number; offset: number; hasMore: boolean };
      }>(`${apiBase}/catalog/${tenantSlug.value}?limit=${CATALOG_PAGE_SIZE}&offset=${currentOffset}`);

      // Append new products (use a writable copy via useState)
      const currentProducts = useState<StorefrontProduct[]>("storefront-products");
      currentProducts.value = [...currentProducts.value, ...catalogData.products];
      hasMore.value = catalogData.pagination?.hasMore ?? false;
      currentOffset += catalogData.products.length;

      return hasMore.value;
    } catch {
      // Non-fatal: user can retry by scrolling again
      return false;
    } finally {
      isLoadingMore.value = false;
    }
  }

  /** Refresh all storefront data (resets pagination). */
  async function refresh() {
    await fetchCatalog();
  }

  return {
    business: readonly(business),
    products: readonly(products),
    categories: readonly(categories),
    storeInfo: readonly(storeInfo),
    exchangeRate: readonly(exchangeRate),
    isLoading: readonly(isLoading),
    isLoadingMore: readonly(isLoadingMore),
    hasMore: readonly(hasMore),
    error: readonly(error),
    fetchCatalog,
    fetchMore,
    refresh,
  };
}
