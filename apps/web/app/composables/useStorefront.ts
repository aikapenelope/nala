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
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /** Fetch catalog data from the public API. */
  async function fetchCatalog() {
    if (!tenantSlug.value) {
      error.value = "No se detecto la tienda.";
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const [catalogData, storeData] = await Promise.all([
        $fetch<{
          business: StorefrontBusiness;
          categories: StorefrontCategory[];
          products: StorefrontProduct[];
        }>(`${apiBase}/catalog/${tenantSlug.value}`),
        $fetch<StoreInfo>(`${apiBase}/catalog/${tenantSlug.value}/store-info`).catch(
          () => null,
        ),
      ]);

      business.value = catalogData.business;
      products.value = catalogData.products;
      categories.value = catalogData.categories;
      storeInfo.value = storeData;
    } catch {
      error.value = "No se pudo cargar la tienda. Verifica el enlace.";
    } finally {
      isLoading.value = false;
    }
  }

  /** Refresh all storefront data. */
  async function refresh() {
    await fetchCatalog();
  }

  return {
    business: readonly(business),
    products: readonly(products),
    categories: readonly(categories),
    storeInfo: readonly(storeInfo),
    isLoading: readonly(isLoading),
    error: readonly(error),
    fetchCatalog,
    refresh,
  };
}
