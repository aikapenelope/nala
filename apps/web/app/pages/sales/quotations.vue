<script setup lang="ts">
/**
 * Quotations page - list, create, and convert to sale.
 *
 * Connected to:
 * - GET /api/quotations
 * - POST /api/quotations
 * - POST /api/quotations/:id/convert
 */

import { Plus, X } from "lucide-vue-next";

definePageMeta({ middleware: ["admin-only"] });

const router = useRouter();
const { $api } = useApi();

const isLoading = ref(true);
const loadError = ref("");

interface Quotation {
  id: string;
  customerId: string | null;
  totalUsd: string;
  status: string;
  items: Array<{ quantity: number; unitPrice: number; discountPercent: number }>;
  createdAt: string;
  expiresAt: string | null;
}

const quotations = ref<Quotation[]>([]);

async function fetchQuotations() {
  isLoading.value = true;
  loadError.value = "";
  try {
    const result = await $api<{ quotations: Quotation[] }>("/api/quotations");
    quotations.value = result.quotations;
  } catch (err) {
    loadError.value =
      err instanceof Error ? err.message : "Error cargando cotizaciones";
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchQuotations);

/** Create quotation modal. */
const showCreate = ref(false);
const newItems = ref<
  Array<{ productId: string; quantity: number; unitPrice: number; discountPercent: number }>
>([{ productId: "", quantity: 1, unitPrice: 0, discountPercent: 0 }]);
const newCustomerId = ref("");
const createSubmitting = ref(false);
const createError = ref("");

function addItem() {
  newItems.value.push({ productId: "", quantity: 1, unitPrice: 0, discountPercent: 0 });
}

function removeItem(idx: number) {
  if (newItems.value.length > 1) newItems.value.splice(idx, 1);
}

const newTotal = computed(() =>
  newItems.value.reduce(
    (sum, i) =>
      sum + i.quantity * i.unitPrice * (1 - i.discountPercent / 100),
    0,
  ),
);

async function submitCreate() {
  const validItems = newItems.value.filter(
    (i) => i.productId && i.quantity > 0 && i.unitPrice > 0,
  );
  if (validItems.length === 0) {
    createError.value = "Agrega al menos un item con producto, cantidad y precio";
    return;
  }
  createSubmitting.value = true;
  createError.value = "";
  try {
    await $api("/api/quotations", {
      method: "POST",
      body: {
        customerId: newCustomerId.value || undefined,
        items: validItems,
      },
    });
    showCreate.value = false;
    newItems.value = [{ productId: "", quantity: 1, unitPrice: 0, discountPercent: 0 }];
    newCustomerId.value = "";
    await fetchQuotations();
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    createError.value = fetchError.data?.error ?? "Error creando cotizacion";
  } finally {
    createSubmitting.value = false;
  }
}

/** Convert quotation to sale. */
async function convertToSale(id: string) {
  try {
    await $api(`/api/quotations/${id}/convert`, { method: "POST" });
    // Redirect to checkout with the quotation items
    router.push("/sales");
  } catch {
    // Non-critical
  }
  await fetchQuotations();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
  });
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <NuxtLink
          to="/sales"
          class="mb-1 inline-flex items-center gap-1 text-sm font-bold text-gray-400 transition-spring hover:text-gray-600"
        >
          ← Ventas
        </NuxtLink>
        <h1 class="text-2xl font-extrabold tracking-tight text-gradient">Cotizaciones</h1>
      </div>
      <button
        class="dark-pill flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-bold transition-spring"
        @click="showCreate = true"
      >
        <Plus :size="14" />
        Nueva
      </button>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary" />
      Cargando...
    </div>

    <div
      v-else-if="loadError"
      class="card-premium p-6 text-center"
    >
      <p class="text-sm font-semibold text-red-500">{{ loadError }}</p>
    </div>

    <div
      v-else-if="quotations.length === 0"
      class="card-premium py-12 text-center"
    >
      <p class="text-sm font-medium text-gray-400">No hay cotizaciones</p>
    </div>

    <div v-else class="space-y-2.5">
      <div
        v-for="q in quotations"
        :key="q.id"
        class="card-premium p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-lg font-extrabold text-gray-800">
              ${{ Number(q.totalUsd).toFixed(2) }}
            </p>
            <p class="text-xs font-medium text-gray-500">
              {{ formatDate(q.createdAt) }}
              <span
                class="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                :class="
                  q.status === 'draft'
                    ? 'bg-yellow-50 text-yellow-700'
                    : q.status === 'converted'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                "
              >
                {{ q.status === "draft" ? "Borrador" : q.status === "converted" ? "Convertida" : q.status }}
              </span>
            </p>
          </div>
          <button
            v-if="q.status === 'draft'"
            class="rounded-2xl bg-green-600 px-4 py-2 text-xs font-bold text-white transition-spring hover:bg-green-700"
            @click="convertToSale(q.id)"
          >
            Convertir a venta
          </button>
        </div>
      </div>
    </div>

    <!-- Create quotation modal -->
    <Teleport to="body">
      <div
        v-if="showCreate"
        class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
        @click.self="showCreate = false"
      >
        <div class="glass-strong w-full max-w-md rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
          <h3 class="mb-5 text-xl font-extrabold tracking-tight text-gradient">
            Nueva cotizacion
          </h3>

          <div class="mb-4">
            <label class="mb-1.5 block text-[13px] font-bold text-gray-600">
              Cliente (opcional)
            </label>
            <input
              v-model="newCustomerId"
              type="text"
              placeholder="ID del cliente"
              class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
            >
          </div>

          <div class="space-y-2.5">
            <div
              v-for="(item, idx) in newItems"
              :key="idx"
              class="glass flex gap-2 rounded-2xl p-3"
            >
              <input
                v-model="item.productId"
                type="text"
                placeholder="ID producto"
                class="flex-1 rounded-xl border border-white bg-white/60 px-2.5 py-1.5 text-xs font-semibold text-gray-800 outline-none transition-spring focus:bg-white"
              >
              <input
                v-model.number="item.quantity"
                type="number"
                min="1"
                placeholder="Cant"
                class="w-14 rounded-xl border border-white bg-white/60 px-2 py-1.5 text-xs font-semibold text-gray-800 outline-none transition-spring focus:bg-white"
              >
              <input
                v-model.number="item.unitPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="Precio"
                class="w-20 rounded-xl border border-white bg-white/60 px-2 py-1.5 text-xs font-semibold text-gray-800 outline-none transition-spring focus:bg-white"
              >
              <button
                v-if="newItems.length > 1"
                class="flex h-6 w-6 items-center justify-center rounded-lg text-gray-300 transition-spring hover:bg-red-50 hover:text-red-500"
                @click="removeItem(idx)"
              >
                <X :size="12" />
              </button>
            </div>
          </div>

          <button
            class="mt-3 text-xs font-bold text-nova-primary transition-spring hover:text-nova-accent"
            @click="addItem"
          >
            + Agregar item
          </button>

          <p class="mt-3 text-right text-sm font-extrabold text-gray-800">
            Total: ${{ newTotal.toFixed(2) }}
          </p>

          <p v-if="createError" class="mt-3 text-sm font-semibold text-red-500">
            {{ createError }}
          </p>

          <div class="mt-5 flex gap-3">
            <button
              class="glass flex-1 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
              @click="showCreate = false"
            >
              Cancelar
            </button>
            <button
              class="dark-pill flex-1 rounded-2xl py-3 text-sm font-bold transition-spring disabled:opacity-50"
              :disabled="createSubmitting"
              @click="submitCreate"
            >
              {{ createSubmitting ? "Creando..." : "Crear cotizacion" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
