<script setup lang="ts">
/**
 * Quotations page - list, create, and convert to sale.
 *
 * Connected to:
 * - GET /api/quotations
 * - POST /api/quotations
 * - POST /api/quotations/:id/convert
 */

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
          class="mb-1 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Ventas
        </NuxtLink>
        <h1 class="text-xl font-bold text-gray-900">Cotizaciones</h1>
      </div>
      <button
        class="rounded-lg bg-nova-primary px-4 py-2 text-sm font-medium text-white"
        @click="showCreate = true"
      >
        + Nueva
      </button>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
    </div>

    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
    </div>

    <div
      v-else-if="quotations.length === 0"
      class="py-12 text-center text-gray-400"
    >
      No hay cotizaciones
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="q in quotations"
        :key="q.id"
        class="rounded-xl bg-white p-4 shadow-sm"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-900">
              ${{ Number(q.totalUsd).toFixed(2) }}
            </p>
            <p class="text-xs text-gray-500">
              {{ formatDate(q.createdAt) }}
              <span
                class="ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                :class="
                  q.status === 'draft'
                    ? 'bg-yellow-100 text-yellow-700'
                    : q.status === 'converted'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                "
              >
                {{ q.status === "draft" ? "Borrador" : q.status === "converted" ? "Convertida" : q.status }}
              </span>
            </p>
          </div>
          <button
            v-if="q.status === 'draft'"
            class="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white"
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
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4"
        @click.self="showCreate = false"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="mb-4 text-lg font-semibold text-gray-900">
            Nueva cotizacion
          </h3>

          <div class="mb-4">
            <label class="mb-1 block text-sm text-gray-600">
              Cliente (opcional)
            </label>
            <input
              v-model="newCustomerId"
              type="text"
              placeholder="ID del cliente"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            >
          </div>

          <div class="space-y-3">
            <div
              v-for="(item, idx) in newItems"
              :key="idx"
              class="flex gap-2 rounded-lg border border-gray-200 p-3"
            >
              <input
                v-model="item.productId"
                type="text"
                placeholder="ID producto"
                class="flex-1 rounded border border-gray-200 px-2 py-1 text-xs"
              >
              <input
                v-model.number="item.quantity"
                type="number"
                min="1"
                placeholder="Cant"
                class="w-14 rounded border border-gray-200 px-2 py-1 text-xs"
              >
              <input
                v-model.number="item.unitPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="Precio"
                class="w-20 rounded border border-gray-200 px-2 py-1 text-xs"
              >
              <button
                v-if="newItems.length > 1"
                class="text-xs text-red-400"
                @click="removeItem(idx)"
              >
                x
              </button>
            </div>
          </div>

          <button
            class="mt-2 text-xs text-nova-primary"
            @click="addItem"
          >
            + Agregar item
          </button>

          <p class="mt-3 text-right text-sm font-bold text-gray-900">
            Total: ${{ newTotal.toFixed(2) }}
          </p>

          <p v-if="createError" class="mt-2 text-sm text-red-500">
            {{ createError }}
          </p>

          <div class="mt-4 flex gap-3">
            <button
              class="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
              @click="showCreate = false"
            >
              Cancelar
            </button>
            <button
              class="flex-1 rounded-lg bg-nova-primary py-2 text-sm font-medium text-white disabled:opacity-50"
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
