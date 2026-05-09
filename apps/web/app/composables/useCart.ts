/**
 * Shopping cart composable for the storefront.
 *
 * Persists cart items in localStorage keyed by tenant slug.
 * Provides add, remove, update quantity, clear, and computed totals.
 *
 * Usage:
 *   const { items, addItem, removeItem, updateQuantity, clear, itemCount, subtotal } = useCart();
 */

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
}

const CART_STORAGE_KEY = "nova-storefront-cart";

/** Get the storage key scoped to the current tenant. */
function getStorageKey(slug: string | null): string {
  return slug ? `${CART_STORAGE_KEY}-${slug}` : CART_STORAGE_KEY;
}

/** Load cart from localStorage. */
function loadCart(slug: string | null): CartItem[] {
  if (!import.meta.client) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as CartItem[];
  } catch {
    return [];
  }
}

/** Save cart to localStorage. */
function saveCart(slug: string | null, items: CartItem[]): void {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(getStorageKey(slug), JSON.stringify(items));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function useCart() {
  const { tenantSlug } = useTenant();

  const items = useState<CartItem[]>("storefront-cart", () =>
    loadCart(tenantSlug.value),
  );

  // Hydrate from localStorage on client mount
  if (import.meta.client && items.value.length === 0) {
    const stored = loadCart(tenantSlug.value);
    if (stored.length > 0) {
      items.value = stored;
    }
  }

  /** Persist cart whenever items change. */
  function persist() {
    saveCart(tenantSlug.value, items.value);
  }

  /** Add a product to the cart. If already present, increment quantity. */
  function addItem(product: {
    id: string;
    name: string;
    price: number;
    imageUrl: string | null;
  }) {
    const existing = items.value.find((i) => i.productId === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      items.value.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        imageUrl: product.imageUrl,
      });
    }
    persist();
  }

  /** Remove a product from the cart entirely. */
  function removeItem(productId: string) {
    items.value = items.value.filter((i) => i.productId !== productId);
    persist();
  }

  /** Update the quantity of a specific item. Removes if quantity <= 0. */
  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    const item = items.value.find((i) => i.productId === productId);
    if (item) {
      item.quantity = quantity;
      persist();
    }
  }

  /** Clear the entire cart. */
  function clear() {
    items.value = [];
    persist();
  }

  /** Total number of items (sum of quantities). */
  const itemCount = computed(() =>
    items.value.reduce((sum, i) => sum + i.quantity, 0),
  );

  /** Subtotal in USD. */
  const subtotal = computed(() =>
    items.value.reduce((sum, i) => sum + i.price * i.quantity, 0),
  );

  return {
    items: readonly(items),
    addItem,
    removeItem,
    updateQuantity,
    clear,
    itemCount,
    subtotal,
  };
}
