<script setup lang="ts">
/**
 * POS sales screen.
 *
 * Design: Grid of products (most sold first) + active ticket on the right.
 * Mobile: product grid fills screen, ticket slides up from bottom.
 *
 * Flow: tap product → adds to ticket → tap "Cobrar $XX" → checkout.
 * 3-4 taps to complete a sale.
 */

import { calculateLineTotal, calculateSaleTotal } from "@nova/shared";

const { isDesktop } = useDevice();

/** Active ticket items. */
interface TicketItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

const ticketItems = ref<TicketItem[]>([]);
const searchQuery = ref("");
const showCheckout = ref(false);

/** Mock products for the grid. Ordered by frequency (most sold first). */
const gridProducts = ref([
  { id: "1", name: "Pan Campesino", price: 1.5, stock: 200 },
  { id: "2", name: "Café con Leche", price: 1.0, stock: 100 },
  { id: "3", name: "Queso Blanco", price: 3.0, stock: 45 },
  { id: "4", name: "Harina PAN 1kg", price: 2.0, stock: 5 },
  { id: "5", name: "Aceite Diana 1L", price: 4.5, stock: 12 },
  { id: "6", name: "Azúcar 1kg", price: 1.8, stock: 30 },
  { id: "7", name: "Arroz 1kg", price: 1.2, stock: 50 },
  { id: "8", name: "Pasta 500g", price: 0.8, stock: 80 },
  { id: "9", name: "Leche 1L", price: 2.5, stock: 20 },
]);

/** Add product to ticket or increment quantity if already there. */
function addToTicket(product: (typeof gridProducts.value)[0]) {
  const existing = ticketItems.value.find(
    (item) => item.productId === product.id,
  );
  if (existing) {
    existing.quantity++;
  } else {
    ticketItems.value.push({
      id: crypto.randomUUID(),
      productId: product.id,
      name: product.name,
      quantity: 1,
      unitPrice: product.price,
      discountPercent: 0,
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
  item.quantity = Math.max(1, item.quantity + delta);
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

/** Filtered products based on search. */
const filteredProducts = computed(() => {
  if (!searchQuery.value) return gridProducts.value;
  const q = searchQuery.value.toLowerCase();
  return gridProducts.value.filter((p) => p.name.toLowerCase().includes(q));
});

/** Clear the ticket after a successful sale. Called from checkout. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used by checkout flow in Sprint 3.4
function clearTicket() {
  ticketItems.value = [];
  showCheckout.value = false;
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

      <!-- Product grid -->
      <div
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
          <span class="text-sm font-medium text-gray-900 text-center truncate w-full">
            {{ product.name }}
          </span>
          <span class="mt-1 text-xs font-semibold text-nova-primary">
            ${{ product.price.toFixed(2) }}
          </span>
          <span
            v-if="product.stock <= 5"
            class="mt-0.5 text-[10px] text-stock-red"
          >
            {{ product.stock }} left
          </span>
        </button>
      </div>
    </div>

    <!-- Ticket (right side on desktop, bottom sheet on mobile) -->
    <div
      v-if="ticketItems.length > 0 || isDesktop"
      class="rounded-xl bg-white shadow-sm"
      :class="isDesktop ? 'w-80 flex flex-col' : 'fixed bottom-16 left-0 right-0 z-40 mx-2 max-h-[50vh] flex flex-col'"
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
          <div class="flex-1 min-w-0">
            <p class="truncate text-sm text-gray-900">{{ item.name }}</p>
            <div class="flex items-center gap-2 mt-0.5">
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
        <NuxtLink
          to="/sales/checkout"
          class="block w-full rounded-xl bg-nova-primary py-3 text-center font-semibold text-white"
        >
          Cobrar ${{ ticketTotal.toFixed(2) }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
