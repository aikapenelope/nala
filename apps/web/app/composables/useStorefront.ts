/**
 * Storefront data composable.
 *
 * Provides shared reactive state for the storefront catalog.
 * Data is fetched via `useStorefrontData()` (SSR-compatible with useAsyncData)
 * and stored in global useState so all components share the same data.
 *
 * Usage:
 *   const { business, products, categories, storeInfo, isLoading, error } = useStorefront();
 */

export interface StorefrontProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  images: ReadonlyArray<{ id: string; url: string; sortOrder: number }>;
  categoryName: string | null;
  available: boolean;
  sku: string | null;
  brand: string | null;
  hasVariants: boolean;
  isService: boolean;
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

export interface DayHours {
  open: string;
  close: string;
}

export type BusinessHours = Record<
  "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
  DayHours | null
> | null;

export interface StoreInfo {
  storeEnabled: boolean;
  paymentMethods: PaymentMethodDetail[];
  deliveryEnabled: boolean;
  deliveryFee: number;
  deliveryZones: string | null;
  welcomeMessage: string | null;
  minOrderAmount: number;
  businessHours: BusinessHours;
}

/** Page size for paginated catalog requests. */
const CATALOG_PAGE_SIZE = 50;

/** Response shape from the catalog API. */
export interface CatalogResponse {
  business: StorefrontBusiness;
  categories: StorefrontCategory[];
  products: StorefrontProduct[];
  exchangeRate: number | null;
  pagination?: { total: number; limit: number; offset: number; hasMore: boolean };
}

/**
 * SSR-compatible data fetching for the storefront catalog.
 *
 * Uses `useAsyncData` so the fetch runs on the server during SSR and the
 * result is serialized into the HTML payload — the client hydrates instantly
 * without a second network request.
 *
 * Call this once in the catalog page (`tienda/index.vue`). The data is
 * stored in shared `useState` refs so other components (layout, cart, etc.)
 * can access it via `useStorefront()`.
 */
export function useStorefrontData() {
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
  const hasMore = useState<boolean>("storefront-has-more", () => false);
  const currentOffset = useState<number>("storefront-offset", () => 0);

  const { status, error, refresh } = useAsyncData(
    `storefront-catalog-${tenantSlug.value}`,
    async () => {
      if (!tenantSlug.value) return null;

      const [catalogData, storeData] = await Promise.all([
        $fetch<CatalogResponse>(
          `${apiBase}/catalog/${tenantSlug.value}?limit=${CATALOG_PAGE_SIZE}&offset=0`,
        ),
        $fetch<StoreInfo>(
          `${apiBase}/catalog/${tenantSlug.value}/store-info`,
        ).catch(() => null),
      ]);

      // Populate shared state
      business.value = catalogData.business;
      products.value = catalogData.products;
      categories.value = catalogData.categories;
      exchangeRate.value = catalogData.exchangeRate;
      storeInfo.value = storeData;
      hasMore.value = catalogData.pagination?.hasMore ?? false;
      currentOffset.value = catalogData.products.length;

      return catalogData;
    },
    {
      // Only fetch if we have a tenant and data isn't already loaded
      immediate: !!tenantSlug.value && products.value.length === 0,
      // Use cached data for 60s on client-side navigations (SWR pattern)
      getCachedData(key, nuxtApp) {
        const cached = nuxtApp.payload.data[key] || nuxtApp.static.data[key];
        if (!cached) return undefined;
        return cached as CatalogResponse;
      },
    },
  );

  const isLoading = computed(() => status.value === "pending");
  const errorMessage = computed(() =>
    error.value ? "No se pudo cargar la tienda. Verifica el enlace." : null,
  );

  return {
    business: readonly(business),
    products: readonly(products),
    categories: readonly(categories),
    storeInfo: readonly(storeInfo),
    exchangeRate: readonly(exchangeRate),
    hasMore: readonly(hasMore),
    isLoading,
    error: errorMessage,
    refresh,
  };
}

/**
 * Fetch the next page of products (client-side only, for infinite scroll).
 *
 * Appends products to the shared state. Not SSR-compatible by design
 * since pagination beyond page 1 is always triggered by user interaction.
 */
export function useStorefrontPagination() {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase as string;
  const { tenantSlug } = useTenant();

  const products = useState<StorefrontProduct[]>("storefront-products");
  const hasMore = useState<boolean>("storefront-has-more");
  const currentOffset = useState<number>("storefront-offset");
  const isLoadingMore = ref(false);

  async function fetchMore(): Promise<boolean> {
    if (!tenantSlug.value || !hasMore.value || isLoadingMore.value) {
      return false;
    }

    isLoadingMore.value = true;

    try {
      const catalogData = await $fetch<{
        products: StorefrontProduct[];
        pagination?: { total: number; limit: number; offset: number; hasMore: boolean };
      }>(`${apiBase}/catalog/${tenantSlug.value}?limit=${CATALOG_PAGE_SIZE}&offset=${currentOffset.value}`);

      products.value = [...products.value, ...catalogData.products];
      hasMore.value = catalogData.pagination?.hasMore ?? false;
      currentOffset.value += catalogData.products.length;

      return hasMore.value;
    } catch {
      // Non-fatal: user can retry by scrolling again
      return false;
    } finally {
      isLoadingMore.value = false;
    }
  }

  return {
    isLoadingMore: readonly(isLoadingMore),
    fetchMore,
  };
}

/**
 * Read-only access to storefront shared state.
 *
 * Use this in components that only need to read the data (layout, cart,
 * checkout, info, product detail). Does NOT trigger any fetching.
 */
export function useStorefront() {
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

  return {
    business: readonly(business),
    products: readonly(products),
    categories: readonly(categories),
    storeInfo: readonly(storeInfo),
    exchangeRate: readonly(exchangeRate),
  };
}
