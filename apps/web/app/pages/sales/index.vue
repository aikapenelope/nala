<script setup lang="ts">
/**
 * POS sales screen — simplified flow.
 *
 * Two modes:
 * 1. Product sale: tap product -> select payment -> confirm (one screen)
 * 2. Quick sale: tap "$" -> enter amount -> select payment -> confirm
 *
 * Design: Category tabs + product grid + ticket with inline payment.
 * Mobile: product grid fills screen, ticket slides up from bottom.
 *
 * Connected to:
 * - GET /api/categories (category tabs)
 * - GET /api/products?limit=200 (product grid)
 * - POST /api/sales (product sale)
 * - POST /api/sales/quick (quick sale)
 */

import { calculateLineTotal, calculateSaleTotal } from "@nova/shared";
import type { PaymentMethod } from "@nova/shared";
import { ShoppingCart, Minus, Plus, X, Search, PlusCircle, DollarSign, Check, Share2, Download } from "lucide-vue-next";
import { sendReceiptWhatsApp, downloadReceiptImage } from "~/composables/useReceiptImage";
import type { ReceiptData } from "~/composables/useReceiptImage";

const { isDesktop } = useDevice();
const { isActive: tutorialActive, activeStep, progress: tutorialProgress, maybeStart: startTutorial, next: tutorialNext, finish: tutorialFinish } = usePosTutorial();
const { $api, apiBase } = useApi();
const { toast } = useToast();
const { user } = useNovaAuth();

/** Resolve image URL: prepend API base for relative paths from the API. */
function resolveImageUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `${apiBase}${url}`;
}

// ============================================================
// Product grid state
// ============================================================

interface GridProduct {
  id: string;
  name: string;
  price: string;
  stock: number;
  barcode: string | null;
  imageUrl: string | null;
  categoryId: string | null;
}

interface Category {
  id: string;
  name: string;
}

const gridProducts = ref<GridProduct[]>([]);
const categories = ref<Category[]>([]);
const selectedCategory = ref<string | null>(null);
const searchQuery = ref("");
const isLoadingProducts = ref(true);
const loadError = ref("");
const recentlyAdded = ref<string | null>(null);

onMounted(async () => {
  try {
    const [catResult, prodResult] = await Promise.all([
      $api<{ categories: Category[] }>("/api/categories"),
      $api<{ products: GridProduct[] }>("/api/products?limit=200"),
    ]);
    categories.value = catResult.categories;
    gridProducts.value = prodResult.products;
    // Start tutorial after products are loaded (first visit only)
    nextTick(() => startTutorial());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error cargando productos";
    loadError.value = message;
    console.error("[POS] Failed to load products:", message);
  } finally {
    isLoadingProducts.value = false;
  }
});

/** Retry loading products after an error. */
async function retryLoadProducts() {
  loadError.value = "";
  isLoadingProducts.value = true;
  try {
    const [catResult, prodResult] = await Promise.all([
      $api<{ categories: Category[] }>("/api/categories"),
      $api<{ products: GridProduct[] }>("/api/products?limit=200"),
    ]);
    categories.value = catResult.categories;
    gridProducts.value = prodResult.products;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error cargando productos";
    loadError.value = message;
  } finally {
    isLoadingProducts.value = false;
  }
}

const filteredProducts = computed(() => {
  let result = gridProducts.value;
  if (selectedCategory.value) {
    result = result.filter((p) => p.categoryId === selectedCategory.value);
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase().trim();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase() === q),
    );
  }
  return result;
});

function autoAddScannedProduct() {
  const match = filteredProducts.value[0];
  if (filteredProducts.value.length === 1 && match) {
    addToTicket(match);
    searchQuery.value = "";
  }
}

// ============================================================
// Ticket state
// ============================================================

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

function addToTicket(product: GridProduct) {
  if (product.stock <= 0) return;
  const existing = ticketItems.value.find((item) => item.productId === product.id);
  if (existing) {
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
  recentlyAdded.value = product.id;
  setTimeout(() => { recentlyAdded.value = null; }, 500);
}

function removeFromTicket(itemId: string) {
  ticketItems.value = ticketItems.value.filter((item) => item.id !== itemId);
}

function updateQuantity(itemId: string, delta: number) {
  const item = ticketItems.value.find((i) => i.id === itemId);
  if (!item) return;
  const newQty = item.quantity + delta;
  if (newQty < 1 || newQty > item.maxStock) return;
  item.quantity = newQty;
}

function lineTotal(item: TicketItem): number {
  return calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent);
}

const ticketTotal = computed(() => {
  return calculateSaleTotal(
    ticketItems.value.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
    })),
  );
});

// ============================================================
// Inline payment + confirm
// ============================================================

const selectedMethod = ref<PaymentMethod | null>(null);
const paymentReference = ref("");
const isSubmitting = ref(false);
const saleComplete = ref(false);

// ============================================================
// Optional customer (CRM capture on every sale)
// ============================================================

interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}

const selectedCustomerId = ref<string | null>(null);
const selectedCustomerName = ref("");
const selectedCustomerPhone = ref<string | null>(null);
const customerQuery = ref("");
const customerResults = ref<CustomerOption[]>([]);
const showCustomerDropdown = ref(false);
const isSearchingCustomers = ref(false);
let customerSearchTimer: ReturnType<typeof setTimeout> | null = null;

function onCustomerInput() {
  selectedCustomerId.value = null;
  selectedCustomerName.value = "";
  selectedCustomerPhone.value = null;
  if (customerSearchTimer) clearTimeout(customerSearchTimer);

  const q = customerQuery.value.trim();
  if (q.length < 2) {
    customerResults.value = [];
    showCustomerDropdown.value = false;
    return;
  }

  customerSearchTimer = setTimeout(async () => {
    isSearchingCustomers.value = true;
    try {
      const result = await $api<{ customers: CustomerOption[] }>(
        `/api/customers?search=${encodeURIComponent(q)}&limit=5`,
      );
      customerResults.value = result.customers;
      showCustomerDropdown.value = result.customers.length > 0;
    } catch {
      customerResults.value = [];
    } finally {
      isSearchingCustomers.value = false;
    }
  }, 250);
}

function selectCustomer(c: CustomerOption) {
  selectedCustomerId.value = c.id;
  selectedCustomerName.value = c.name;
  selectedCustomerPhone.value = c.phone;
  customerQuery.value = c.name;
  showCustomerDropdown.value = false;
}

function clearCustomer() {
  selectedCustomerId.value = null;
  selectedCustomerName.value = "";
  selectedCustomerPhone.value = null;
  customerQuery.value = "";
  customerResults.value = [];
  showCustomerDropdown.value = false;
}

const paymentMethods: Array<{ value: PaymentMethod; label: string; icon: string; needsRef: boolean }> = [
  { value: "efectivo", label: "Efectivo", icon: "💵", needsRef: false },
  { value: "pago_movil", label: "P. Movil", icon: "📱", needsRef: true },
  { value: "binance", label: "Binance", icon: "🪙", needsRef: true },
  { value: "zelle", label: "Zelle", icon: "💸", needsRef: true },
  { value: "transferencia", label: "Transfer.", icon: "🏦", needsRef: true },
];

const needsReference = computed(() => {
  if (!selectedMethod.value) return false;
  return paymentMethods.find((m) => m.value === selectedMethod.value)?.needsRef ?? false;
});

const canConfirm = computed(() => {
  return ticketItems.value.length > 0 && selectedMethod.value !== null;
});

/** Confirm sale with products (POST /api/sales). */
async function confirmSale() {
  if (!canConfirm.value || !selectedMethod.value) return;
  isSubmitting.value = true;

  try {
    await $api("/api/sales", {
      method: "POST",
      body: {
        items: ticketItems.value.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
        })),
        payments: [{
          method: selectedMethod.value,
          amountUsd: ticketTotal.value,
          reference: paymentReference.value || undefined,
        }],
        discountPercent: 0,
        discountAmount: 0,
        channel: "pos",
        customerId: selectedCustomerId.value || undefined,
      },
    });

    saleComplete.value = true;
    toast("Venta registrada", "success");
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    toast(fetchError.data?.error ?? "Error al registrar la venta", "error");
  } finally {
    isSubmitting.value = false;
  }
}

/** Reset for next sale. */
function newSale() {
  ticketItems.value = [];
  selectedMethod.value = null;
  paymentReference.value = "";
  saleComplete.value = false;
  clearCustomer();
}

/** Build receipt data from current ticket state. */
function buildPosReceiptData(): ReceiptData {
  const methodLabel =
    paymentMethods.find((m) => m.value === selectedMethod.value)?.label ??
    (selectedMethod.value ?? "");

  return {
    businessName: user.value?.businessName ?? "Mi Negocio",
    items: ticketItems.value.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: lineTotal(item),
    })),
    subtotal: ticketTotal.value,
    totalUsd: ticketTotal.value,
    paymentMethod: methodLabel,
    date: new Date(),
  };
}

/** Send receipt text via WhatsApp. */
function sendPosReceiptWA() {
  if (!selectedMethod.value) return;
  const ok = sendReceiptWhatsApp(buildPosReceiptData(), selectedCustomerPhone.value);
  if (!ok) {
    toast("No se pudo abrir WhatsApp. Intenta descargar el recibo.", "error");
  }
}

/** Download receipt as PNG image. */
function downloadPosReceipt() {
  if (!selectedMethod.value) return;
  const ok = downloadReceiptImage(buildPosReceiptData());
  if (!ok) {
    toast("Error generando imagen del recibo", "error");
  }
}

// ============================================================
// Quick sale modal (amount-only, no product)
// ============================================================

const showQuickSale = ref(false);
const quickAmount = ref<number | null>(null);
const quickMethod = ref<PaymentMethod | null>(null);
const quickDescription = ref("");
const quickReference = ref("");
const quickSubmitting = ref(false);

async function submitQuickSale() {
  if (!quickAmount.value || quickAmount.value <= 0 || !quickMethod.value) return;
  quickSubmitting.value = true;

  try {
    await $api("/api/sales/quick", {
      method: "POST",
      body: {
        amountUsd: quickAmount.value,
        method: quickMethod.value,
        description: quickDescription.value || undefined,
        reference: quickReference.value || undefined,
        channel: "pos",
      },
    });

    toast(`Venta rapida $${quickAmount.value.toFixed(2)} registrada`, "success");
    showQuickSale.value = false;
    quickAmount.value = null;
    quickMethod.value = null;
    quickDescription.value = "";
    quickReference.value = "";
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    toast(fetchError.data?.error ?? "Error al registrar venta", "error");
  } finally {
    quickSubmitting.value = false;
  }
}

// ============================================================
// Quick product creation modal
// ============================================================

const showQuickAdd = ref(false);
const quickName = ref("");
const quickPrice = ref<number | null>(null);
const quickCreating = ref(false);

async function quickCreateProduct() {
  if (!quickName.value.trim() || !quickPrice.value || quickPrice.value <= 0) return;
  quickCreating.value = true;
  try {
    const result = await $api<{ product: { id: string; name: string; price: string } }>(
      "/api/products",
      {
        method: "POST",
        body: { name: quickName.value.trim(), price: quickPrice.value, stock: 999 },
      },
    );
    const newProduct: GridProduct = {
      id: result.product.id,
      name: result.product.name,
      price: result.product.price,
      stock: 999,
      barcode: null,
      imageUrl: null,
      categoryId: null,
    };
    gridProducts.value.unshift(newProduct);
    addToTicket(newProduct);
    showQuickAdd.value = false;
    quickName.value = "";
    quickPrice.value = null;
  } catch {
    // Error creating product
  } finally {
    quickCreating.value = false;
  }
}
/** Navigate to advanced checkout (fiado, surcharges, IGTF). */
function goToAdvancedCheckout() {
  if (import.meta.client) {
    sessionStorage.setItem("nova:checkout:items", JSON.stringify(ticketItems.value));
    sessionStorage.setItem("nova:checkout:total", String(ticketTotal.value));
  }
  navigateTo("/sales/checkout");
}
</script>

<template>
  <div class="flex h-full gap-4" :class="{ 'flex-col': !isDesktop }">
    <!-- Product grid (left side on desktop, full width on mobile) -->
    <div class="flex-1">
      <SharedContextualTip
        tip-id="pos"
        title="Punto de venta"
        description="Toca un producto para agregarlo, selecciona como te pagan, y confirma. O usa Venta Rapida ($) para registrar solo el monto."
      />

      <!-- Search bar + quick actions -->
      <div class="mb-3 flex gap-2">
        <div
          class="glass relative flex flex-1 items-center rounded-2xl px-4 py-2.5"
        >
          <Search :size="16" class="mr-2 flex-shrink-0 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar o escanear..."
            class="w-full bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
            @keydown.enter="autoAddScannedProduct"
          >
        </div>
        <SharedBarcodeScanner
          @scanned="(code: string) => (searchQuery = code)"
          @close="searchQuery = ''"
        />
        <!-- Quick sale button -->
        <button
          class="flex items-center gap-1 rounded-2xl bg-green-600 px-3 py-2.5 text-xs font-bold text-white transition-spring hover:bg-green-700"
          title="Venta rapida (solo monto)"
          @click="showQuickSale = true"
        >
          <DollarSign :size="14" />
          <span class="hidden sm:inline">Rapida</span>
        </button>
        <button
          class="flex items-center gap-1 rounded-2xl bg-nova-primary px-3 py-2.5 text-xs font-bold text-white transition-spring hover:bg-nova-primary/90"
          title="Crear producto rapido"
          @click="showQuickAdd = true"
        >
          <PlusCircle :size="14" />
          <span class="hidden sm:inline">Nuevo</span>
        </button>
      </div>

      <!-- Category tabs -->
      <div
        v-if="categories.length > 0"
        class="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
      >
        <button
          class="flex-shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-spring"
          :class="
            selectedCategory === null
              ? 'bg-nova-primary text-white shadow-sm'
              : 'glass text-gray-600 hover:bg-white/80'
          "
          @click="selectedCategory = null"
        >
          Todos
        </button>
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="flex-shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-spring"
          :class="
            selectedCategory === cat.id
              ? 'bg-nova-primary text-white shadow-sm'
              : 'glass text-gray-600 hover:bg-white/80'
          "
          @click="selectedCategory = cat.id"
        >
          {{ cat.name }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="isLoadingProducts" class="py-12 text-center text-gray-400">
        <div
          class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary"
        />
        Cargando productos...
      </div>

      <!-- Error loading products -->
      <div
        v-else-if="loadError"
        class="card-premium py-12 text-center"
      >
        <p class="text-sm font-semibold text-red-500">{{ loadError }}</p>
        <button
          class="mt-3 text-xs font-bold text-nova-primary underline"
          @click="retryLoadProducts"
        >
          Reintentar
        </button>
        <p class="mt-2 text-xs text-gray-400">
          Usa el boton <span class="font-bold text-green-600">$ Rapida</span> para registrar una venta sin producto
        </p>
      </div>

      <!-- Empty -->
      <div
        v-else-if="filteredProducts.length === 0"
        class="card-premium py-12 text-center"
      >
        <p class="text-sm font-medium text-gray-400">
          {{ searchQuery ? "Sin resultados" : "No hay productos registrados" }}
        </p>
        <p class="mt-2 text-xs text-gray-400">
          Usa el boton <span class="font-bold text-green-600">$ Rapida</span> para registrar una venta sin producto
        </p>
      </div>

      <!-- Product grid -->
      <div
        v-else
        data-tutorial="product-grid"
        class="grid gap-2.5"
        :class="isDesktop ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'"
      >
        <button
          v-for="product in filteredProducts"
          :key="product.id"
          class="card-premium flex flex-col items-center p-3.5 transition-spring active:scale-95"
          :class="{
            'opacity-40': product.stock <= 0,
            'animate-pulse ring-2 ring-nova-accent/50':
              recentlyAdded === product.id,
          }"
          :disabled="product.stock <= 0"
          @click="addToTicket(product)"
        >
          <img
            v-if="product.imageUrl"
            :src="resolveImageUrl(product.imageUrl)"
            :alt="product.name"
            class="mb-2 h-10 w-10 rounded-xl object-cover"
          />
          <div
            v-else
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

    <!-- ============================================================ -->
    <!-- Ticket + inline payment (right side desktop, bottom mobile) -->
    <!-- ============================================================ -->
    <div
      v-if="ticketItems.length > 0 || isDesktop"
      class="glass-strong"
      :class="
        isDesktop
          ? 'w-80 flex flex-col rounded-3xl'
          : 'fixed bottom-16 left-0 right-0 z-40 mx-2 mb-[env(safe-area-inset-bottom)] max-h-[60vh] flex flex-col rounded-t-3xl'
      "
    >
      <!-- Sale complete state -->
      <div v-if="saleComplete" class="flex flex-col items-center justify-center p-6">
        <div class="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
          <Check :size="24" class="text-green-600" />
        </div>
        <p class="text-lg font-extrabold text-gradient">Venta registrada</p>
        <p class="mt-1 text-sm font-bold text-gray-500">${{ ticketTotal.toFixed(2) }}</p>
        <p v-if="selectedCustomerName" class="mt-0.5 text-xs font-medium text-gray-400">{{ selectedCustomerName }}</p>
        <div class="mt-4 flex w-full gap-2">
          <button
            class="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-green-600 py-3 text-sm font-bold text-white transition-spring"
            @click="sendPosReceiptWA"
          >
            <Share2 :size="14" />
            WhatsApp
          </button>
          <button
            class="flex items-center justify-center gap-1.5 rounded-2xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-600 transition-spring hover:bg-gray-200"
            title="Descargar recibo como imagen"
            @click="downloadPosReceipt"
          >
            <Download :size="14" />
          </button>
          <button
            class="dark-pill flex-1 rounded-2xl py-3 text-sm font-bold transition-spring"
            @click="newSale"
          >
            <ShoppingCart :size="14" class="mr-1 inline" />
            Nueva venta
          </button>
        </div>
      </div>

      <!-- Active ticket -->
      <template v-else>
        <div
          class="flex items-center justify-between border-b border-white/50 px-4 py-3"
        >
          <div class="flex items-center gap-2">
            <div
              class="flex h-7 w-7 items-center justify-center rounded-lg bg-nova-primary/10"
            >
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
              <p class="truncate text-[13px] font-semibold text-gray-800">
                {{ item.name }}
              </p>
              <div class="mt-1 flex items-center gap-1.5">
                <button
                  class="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100/80 text-gray-500 transition-spring hover:bg-gray-200"
                  @click="updateQuantity(item.id, -1)"
                >
                  <Minus :size="12" />
                </button>
                <span
                  class="min-w-[20px] text-center text-xs font-bold text-gray-700"
                  >{{ item.quantity }}</span
                >
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

        <!-- Inline payment + confirm -->
        <div v-if="ticketItems.length > 0" class="border-t border-white/50 p-4 space-y-3">
          <!-- Total -->
          <div class="text-center">
            <span class="text-2xl font-extrabold text-gradient">${{ ticketTotal.toFixed(2) }}</span>
          </div>

          <!-- Payment method pills -->
          <div data-tutorial="payment-methods" class="flex flex-wrap gap-1.5 justify-center">
            <button
              v-for="method in paymentMethods"
              :key="method.value"
              class="rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition-spring"
              :class="
                selectedMethod === method.value
                  ? 'bg-nova-primary text-white shadow-sm'
                  : 'glass text-gray-600 hover:bg-white/80'
              "
              @click="selectedMethod = method.value"
            >
              {{ method.icon }} {{ method.label }}
            </button>
          </div>

          <!-- Reference input (for digital payments) -->
          <input
            v-if="needsReference"
            v-model="paymentReference"
            type="text"
            placeholder="Referencia de pago"
            class="w-full rounded-xl border border-white/80 bg-white/40 px-3 py-2 text-xs font-medium text-gray-800 outline-none placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-nova-accent/20"
          >

          <!-- Optional customer (CRM capture) -->
          <div class="relative">
            <div
              v-if="selectedCustomerId"
              class="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2"
            >
              <span class="text-xs font-bold text-green-700">{{ selectedCustomerName }}</span>
              <button
                class="text-gray-400 hover:text-red-500"
                @click="clearCustomer"
              >
                <X :size="12" />
              </button>
            </div>
            <div v-else>
              <input
                v-model="customerQuery"
                type="text"
                placeholder="Cliente (opcional)"
                class="w-full rounded-xl border border-white/80 bg-white/40 px-3 py-2 text-xs font-medium text-gray-800 outline-none placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-nova-accent/20"
                @input="onCustomerInput"
                @focus="showCustomerDropdown = customerResults.length > 0"
              >
              <div
                v-if="showCustomerDropdown"
                class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
              >
                <button
                  v-for="c in customerResults"
                  :key="c.id"
                  class="flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-spring hover:bg-gray-50"
                  @mousedown.prevent="selectCustomer(c)"
                >
                  <span class="font-semibold text-gray-800">{{ c.name }}</span>
                  <span v-if="c.phone" class="text-gray-400">{{ c.phone }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Advanced options link -->
          <button
            type="button"
            class="block w-full text-center text-[11px] font-medium text-gray-400 hover:text-nova-primary"
            @click="goToAdvancedCheckout"
          >
            Fiado, recargos, IGTF →
          </button>

          <!-- Confirm button -->
          <button
            data-tutorial="confirm-btn"
            class="w-full rounded-2xl py-3.5 text-[15px] font-extrabold tracking-wide transition-spring disabled:opacity-50"
            :class="canConfirm ? 'dark-pill' : 'bg-gray-200 text-gray-400'"
            :disabled="!canConfirm || isSubmitting"
            @click="confirmSale"
          >
            {{ isSubmitting ? "Registrando..." : "Confirmar venta" }}
          </button>
        </div>
      </template>
    </div>

    <!-- ============================================================ -->
    <!-- Quick sale modal -->
    <!-- ============================================================ -->
    <Teleport to="body">
      <div
        v-if="showQuickSale"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showQuickSale = false"
      >
        <div class="glass-strong w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-6 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
          <h3 class="mb-4 text-lg font-extrabold text-gradient">Venta rapida</h3>
          <div class="space-y-3">
            <input
              v-model.number="quickAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="Monto ($)"
              autofocus
              class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-center text-xl font-extrabold text-gray-800 outline-none transition-spring placeholder:text-gray-400 placeholder:text-base placeholder:font-medium focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
            >
            <input
              v-model="quickDescription"
              type="text"
              placeholder="Descripcion (opcional)"
              class="w-full rounded-2xl border border-white bg-white/60 px-4 py-2.5 text-sm font-medium text-gray-800 outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
            >

            <!-- Payment methods -->
            <div class="flex flex-wrap gap-1.5 justify-center">
              <button
                v-for="method in paymentMethods"
                :key="method.value"
                class="rounded-xl px-3 py-2 text-xs font-bold transition-spring"
                :class="
                  quickMethod === method.value
                    ? 'bg-nova-primary text-white shadow-sm'
                    : 'glass text-gray-600 hover:bg-white/80'
                "
                @click="quickMethod = method.value"
              >
                {{ method.icon }} {{ method.label }}
              </button>
            </div>

            <!-- Reference (if needed) -->
            <input
              v-if="quickMethod && paymentMethods.find((m) => m.value === quickMethod)?.needsRef"
              v-model="quickReference"
              type="text"
              placeholder="Referencia"
              class="w-full rounded-2xl border border-white bg-white/60 px-4 py-2.5 text-sm font-medium text-gray-800 outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
            >
          </div>
          <div class="mt-4 flex gap-3">
            <button
              class="glass flex-1 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
              @click="showQuickSale = false"
            >
              Cancelar
            </button>
            <button
              class="dark-pill flex-1 rounded-2xl py-3 text-sm font-bold transition-spring disabled:opacity-50"
              :disabled="!quickAmount || quickAmount <= 0 || !quickMethod || quickSubmitting"
              @click="submitQuickSale"
            >
              {{ quickSubmitting ? "Registrando..." : `Registrar $${(quickAmount ?? 0).toFixed(2)}` }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ============================================================ -->
    <!-- Quick product creation modal -->
    <!-- ============================================================ -->
    <Teleport to="body">
      <div
        v-if="showQuickAdd"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showQuickAdd = false"
      >
        <div class="glass-strong w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-6 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
          <h3 class="mb-4 text-lg font-extrabold text-gradient">Producto rapido</h3>
          <div class="space-y-3">
            <input
              v-model="quickName"
              type="text"
              placeholder="Nombre del producto"
              autofocus
              class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
            >
            <input
              v-model.number="quickPrice"
              type="number"
              step="0.01"
              min="0"
              placeholder="Precio ($)"
              class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
            >
          </div>
          <div class="mt-4 flex gap-3">
            <button
              class="glass flex-1 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
              @click="showQuickAdd = false"
            >
              Cancelar
            </button>
            <button
              class="dark-pill flex-1 rounded-2xl py-3 text-sm font-bold transition-spring disabled:opacity-50"
              :disabled="!quickName.trim() || !quickPrice || quickPrice <= 0 || quickCreating"
              @click="quickCreateProduct"
            >
              {{ quickCreating ? "Creando..." : "Crear y agregar" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- POS Tutorial overlay (first visit only) -->
    <SharedPosTutorial
      :is-active="tutorialActive"
      :step="activeStep"
      :progress="tutorialProgress"
      @next="tutorialNext"
      @skip="tutorialFinish"
    />
  </div>
</template>
