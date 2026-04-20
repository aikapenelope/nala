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
import { ShoppingCart, Minus, Plus, X, Search } from "lucide-vue-next";

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
  barcode: string | null;
}

const gridProducts = ref<GridProduct[]>([]);

/** Track recently added product for animation. */
const recentlyAdded = ref<string | null>(null);

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

  // Trigger add animation
  recentlyAdded.value = product.id;
  setTimeout(() => {
    recentlyAdded.value = null;
  }, 400);
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
  );
});

/** Filtered products based on search (name or barcode). */
const filteredProducts = computed(() => {
  if (!searchQuery.value) return gridProducts.value;
  const q = searchQuery.value.toLowerCase().trim();
  return gridProducts.value.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase() === q),
  );
});

/**
 * Auto-add scanned product to ticket.
 * Triggered by Enter key -- barcode guns send digits + Enter automatically.
 * If exactly one product matches the search, add it and clear the field.
 */
function autoAddScannedProduct() {
  const match = filteredProducts.value[0];
  if (filteredProducts.value.length === 1 && match) {
    addToTicket(match);
    searchQuery.value = "";
  }
}

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
        <div class="glass relative flex flex-1 items-center rounded-2xl px-4 py-2.5">
          <Search :size="16" class="mr-2 flex-shrink-0 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar o escanear..."
            class="w-full bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
            @keydown.enter="autoAddScannedProduct"
          />
        </div>
        <SharedBarcodeScanner
          @scanned="(code: string) => (searchQuery = code)"
          @close="searchQuery = ''"
        />
      </div>

      <!-- Loading -->
      <div v-if="isLoadingProducts" class="py-12 text-center text-gray-400">
        <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary" />
        Cargando productos...
      </div>

      <!-- Empty -->
      <div
        v-else-if="filteredProducts.length === 0"
        class="card-premium py-12 text-center"
      >
        <p class="text-sm font-medium text-gray-400">
          {{ searchQuery ? "Sin resultados" : "No hay productos registrados" }}
        </p>
      </div>

      <!-- Product grid -->
      <div
        v-else
        class="grid gap-2.5"
        :class="isDesktop ? 'grid-cols-4' : 'grid-cols-3'"
      >
        <button
          v-for="product in filteredProducts"
          :key="product.id"
          class="card-premium flex flex-col items-center p-3.5 transition-spring active:scale-95"
          :class="{
            'opacity-40': product.stock <= 0,
            'scale-95': recentlyAdded === product.id,
          }"
          :disabled="product.stock <= 0"
          @click="addToTicket(product)"
        >
          <!-- Product initial avatar -->
          <div
            class="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#EFECFF] to-[#D0CCF9] text-sm font-extrabold text-nova-accent"
          >
            {{ product.name.charAt(0) }}
          </div>
          <span
            class="w-full truncate text-center text-[13px] font-semibold text-gray-800"
          >
            {{ product.name }}
          </span>
          <span class="mt-0.5 text-xs font-bold text-nova-primary">
            ${{ Number(product.price).toFixed(2) }}
          </span>
          <span
            v-if="product.stock <= 5"
            class="mt-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-stock-red"
          >
            {{ product.stock }} disp.
          </span>
        </button>
      </div>
    </div>

    <!-- Ticket (right side on desktop, bottom sheet on mobile) -->
    <div
      v-if="ticketItems.length > 0 || isDesktop"
      class="glass-strong"
      :class="
        isDesktop
          ? 'w-80 flex flex-col rounded-3xl'
          : 'fixed bottom-16 left-0 right-0 z-40 mx-2 max-h-[50vh] flex flex-col rounded-t-3xl'
      "
    >
      <div class="flex items-center justify-between border-b border-white/50 px-4 py-3">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-nova-primary/10">
            <ShoppingCart :size="14" class="text-nova-primary" />
          </div>
          <h2 class="text-sm font-bold text-gray-800">
            Ticket ({{ ticketItems.length }})
          </h2>
        </div>
      </div>

      <!-- Items list -->
      <div class="flex-1 overflow-y-auto px-4 py-2">
        <div
          v-for="item in ticketItems"
          :key="item.id"
          class="flex items-center justify-between rounded-2xl px-2 py-2.5 transition-spring hover:bg-white/60"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-semibold text-gray-800">{{ item.name }}</p>
            <div class="mt-1 flex items-center gap-1.5">
              <button
                class="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100/80 text-gray-500 transition-spring hover:bg-gray-200"
                @click="updateQuantity(item.id, -1)"
              >
                <Minus :size="12" />
              </button>
              <span class="min-w-[20px] text-center text-xs font-bold text-gray-700">{{ item.quantity }}</span>
              <button
                class="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100/80 text-gray-500 transition-spring hover:bg-gray-200"
                @click="updateQuantity(item.id, 1)"
              >
                <Plus :size="12" />
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-gray-800">
              ${{ lineTotal(item).toFixed(2) }}
            </span>
            <button
              class="flex h-6 w-6 items-center justify-center rounded-lg text-gray-300 transition-spring hover:bg-red-50 hover:text-red-500"
              @click="removeFromTicket(item.id)"
            >
              <X :size="12" />
            </button>
          </div>
        </div>

        <p
          v-if="ticketItems.length === 0"
          class="py-8 text-center text-sm font-medium text-gray-400"
        >
          Toca un producto para agregar
        </p>
      </div>

      <!-- Checkout button -->
      <div v-if="ticketItems.length > 0" class="border-t border-white/50 p-4">
        <button
          class="dark-pill block w-full rounded-2xl py-3.5 text-center text-[15px] font-extrabold tracking-wide transition-spring"
          @click="goToCheckout"
        >
          Cobrar ${{ ticketTotal.toFixed(2) }}
        </button>
      </div>
    </div>
  </div>
</template>
