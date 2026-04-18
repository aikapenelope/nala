<script setup lang="ts">
/**
 * POS sales screen.
 *
 * Design: Grid of products (most sold first) + active ticket on the right.
 * Mobile: product grid fills screen, ticket slides up from bottom.
 *
 * Flow: tap product -> adds to ticket -> tap "Cobrar $XX" -> checkout.
 * 3-4 taps to complete a sale.
 *
 * Connected to: GET /api/products (loads real product grid)
 */

import { calculateLineTotal, calculateSaleTotal } from "@nova/shared";

const { isDesktop } = useDevice();
const { $api } = useApi();

/** Active ticket items. */
interface TicketItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  maxStock: number;
}

const ticketItems = ref<TicketItem[]>([]);
const searchQuery = ref("");
const isLoadingProducts = ref(true);

/** Products from API for the grid. */
interface GridProduct {
  id: string;
  name: string;
  price: string;
  stock: number;
}

const gridProducts = ref<GridProduct[]>([]);

/** Load products from API on mount. */
onMounted(async () => {
  try {
    const result = await $api<{
      products: GridProduct[];
    }>("/api/products?limit=100");
    gridProducts.value = result.products;
  } catch {
    // Products will show empty grid with error implicit
  } finally {
    isLoadingProducts.value = false;
  }
});

/** Add product to ticket or increment quantity if already there. */
function addToTicket(product: GridProduct) {
  if (product.stock <= 0) return;

  const existing = ticketItems.value.find(
    (item) => item.productId === product.id,
  );
  if (existing) {
    // Don't exceed available stock
    if (existing.quantity >= product.stock) return;
    existing.quantity++;
  } else {
    ticketItems.value.push({
      id: crypto.randomUUID(),
      productId: product.id,
      name: product.name,
      quantity: 1,
      unitPrice: Number(product.price),
      discountPercent: 0,
      maxStock: product.stock,
    });
  }
}

/** Remove item from ticket. */
function removeFromTicket(itemId: string) {
  ticketItems.value = ticketItems.value.filter((item) => item.id !== itemId);
}

/** Update item quantity. */
function updateQuantity(itemId: string, delta: number) {
  const item = ticketItems.value.find((i) => i.id === itemId);
  if (!item) return;
  const newQty = item.quantity + delta;
  if (newQty < 1 || newQty > item.maxStock) return;
  item.quantity = newQty;
}

/** Calculate line total for display. */
function lineTotal(item: TicketItem): number {
  return calculateLineTotal(
    item.quantity,
    item.unitPrice,
    item.discountPercent,
  );
}

/** Total of the entire ticket. */
const ticketTotal = computed(() => {
  return calculateSaleTotal(
    ticketItems.value.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
    })),
  ).total;
});

/** Filtered products based on search. */
const filteredProducts = computed(() => {
  if (!searchQuery.value) return gridProducts.value;
  const q = searchQuery.value.toLowerCase();
  return gridProducts.value.filter((p) => p.name.toLowerCase().includes(q));
});

/**
 * Navigate to checkout, passing ticket data via sessionStorage.
 * sessionStorage is used instead of query params because ticket data
 * can be large and contains structured objects.
 */
function goToCheckout() {
  if (ticketItems.value.length === 0) return;

  if (import.meta.client) {
    sessionStorage.setItem(
      "nova:checkout:items",
      JSON.stringify(ticketItems.value),
    );
    sessionStorage.setItem("nova:checkout:total", String(ticketTotal.value));
  }

  navigateTo("/sales/checkout");
}
</script>

<template>
  <div class="flex h-full gap-4" :class="{ 'flex-col': !isDesktop }">
    <!-- Product grid (left side on desktop, full width on mobile) -->
    <div class="flex-1">
      <!-- Search bar -->
      <div class="mb-3 flex gap-2">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar producto..."
          class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
        />
        <SharedBarcodeScanner
          @scanned="(code: string) => (searchQuery = code)"
          @close="searchQuery = ''"
        />
      </div>

      <!-- Loading -->
      <div v-if="isLoadingProducts" class="py-12 text-center text-gray-400">
        Cargando productos...
      </div>

      <!-- Empty -->
      <div
        v-else-if="filteredProducts.length === 0"
        class="py-12 text-center text-gray-400"
      >
        {{ searchQuery ? "Sin resultados" : "No hay productos registrados" }}
      </div>

      <!-- Product grid -->
      <div
        v-else
        class="grid gap-2"
        :class="isDesktop ? 'grid-cols-4' : 'grid-cols-3'"
      >
        <button
          v-for="product in filteredProducts"
          :key="product.id"
          class="flex flex-col items-center rounded-xl bg-white p-3 shadow-sm transition-colors active:bg-blue-50"
          :class="{ 'opacity-50': product.stock <= 0 }"
          :disabled="product.stock <= 0"
          @click="addToTicket(product)"
        >
          <span
            class="w-full truncate text-center text-sm font-medium text-gray-900"
          >
            {{ product.name }}
          </span>
          <span class="mt-1 text-xs font-semibold text-nova-primary">
            ${{ Number(product.price).toFixed(2) }}
          </span>
          <span
            v-if="product.stock <= 5"
            class="mt-0.5 text-[10px] text-stock-red"
          >
            {{ product.stock }} disp.
          </span>
        </button>
      </div>
    </div>

    <!-- Ticket (right side on desktop, bottom sheet on mobile) -->
    <div
      v-if="ticketItems.length > 0 || isDesktop"
      class="rounded-xl bg-white shadow-sm"
      :class="
        isDesktop
          ? 'w-80 flex flex-col'
          : 'fixed bottom-16 left-0 right-0 z-40 mx-2 max-h-[50vh] flex flex-col'
      "
    >
      <div class="border-b border-gray-100 px-4 py-3">
        <h2 class="text-sm font-semibold text-gray-700">
          Ticket ({{ ticketItems.length }})
        </h2>
      </div>

      <!-- Items list -->
      <div class="flex-1 overflow-y-auto px-4 py-2">
        <div
          v-for="item in ticketItems"
          :key="item.id"
          class="flex items-center justify-between py-2"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-gray-900">{{ item.name }}</p>
            <div class="mt-0.5 flex items-center gap-2">
              <button
                class="h-5 w-5 rounded bg-gray-100 text-xs"
                @click="updateQuantity(item.id, -1)"
              >
                -
              </button>
              <span class="text-xs text-gray-600">{{ item.quantity }}</span>
              <button
                class="h-5 w-5 rounded bg-gray-100 text-xs"
                @click="updateQuantity(item.id, 1)"
              >
                +
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-gray-900">
              ${{ lineTotal(item).toFixed(2) }}
            </span>
            <button
              class="text-xs text-gray-400 hover:text-red-500"
              @click="removeFromTicket(item.id)"
            >
              x
            </button>
          </div>
        </div>

        <p
          v-if="ticketItems.length === 0"
          class="py-8 text-center text-sm text-gray-400"
        >
          Toca un producto para agregar
        </p>
      </div>

      <!-- Checkout button -->
      <div v-if="ticketItems.length > 0" class="border-t border-gray-100 p-4">
        <button
          class="block w-full rounded-xl bg-nova-primary py-3 text-center font-semibold text-white"
          @click="goToCheckout"
        >
          Cobrar ${{ ticketTotal.toFixed(2) }}
        </button>
      </div>
    </div>
  </div>
</template>
