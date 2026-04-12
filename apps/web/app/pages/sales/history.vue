<script setup lang="ts">
/**
 * Sales history page.
 *
 * Connected to:
 * - GET /api/sales?date=&method=&page=&limit=
 * - POST /api/sales/:id/void
 */

const { isDesktop } = useDevice();
const { isAdmin } = useNovaAuth();
const { $api } = useApi();

const dateFilter = ref("");
const methodFilter = ref<string | null>(null);
const isLoading = ref(true);
const loadError = ref("");

/** Sale type from API. */
interface Sale {
  id: string;
  createdAt: string;
  userId: string;
  totalUsd: string;
  totalBs: string | null;
  status: "completed" | "voided";
}

const salesList = ref<Sale[]>([]);
const totalSales = ref(0);
const page = ref(1);
const limit = 50;

/** Fetch sales from API. */
async function fetchSales() {
  isLoading.value = true;
  loadError.value = "";

  try {
    const params = new URLSearchParams();
    if (dateFilter.value) params.set("date", dateFilter.value);
    if (methodFilter.value) params.set("method", methodFilter.value);
    params.set("page", String(page.value));
    params.set("limit", String(limit));

    const result = await $api<{
      sales: Sale[];
      total: number;
    }>(`/api/sales?${params.toString()}`);

    salesList.value = result.sales;
    totalSales.value = result.total;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando ventas";
    loadError.value = message;
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchSales();
});

watch([dateFilter, methodFilter], () => {
  page.value = 1;
  fetchSales();
});

/** Format date for display. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Void sale flow: reason input -> PIN verification -> API call. */
const showReasonModal = ref(false);
const showVoidModal = ref(false);
const voidingSaleId = ref<string | null>(null);
const voidReason = ref("");
const voidError = ref("");

/** Common void reasons for quick selection. */
const commonReasons = [
  "Error en el monto",
  "Cliente cancelo la compra",
  "Producto equivocado",
  "Duplicado",
];

/** Step 1: Show reason input. */
function requestVoid(saleId: string) {
  voidingSaleId.value = saleId;
  voidReason.value = "";
  voidError.value = "";
  showReasonModal.value = true;
}

/** Step 2: Reason entered, now ask for PIN. */
function confirmReason() {
  if (!voidReason.value.trim()) return;
  showReasonModal.value = false;
  showVoidModal.value = true;
}

/** Step 3: PIN verified, send void request. */
async function handleVoidConfirmed() {
  if (!voidingSaleId.value) return;

  try {
    await $api(`/api/sales/${voidingSaleId.value}/void`, {
      method: "POST",
      body: { reason: voidReason.value.trim() },
    });

    // Update local state
    const sale = salesList.value.find((s) => s.id === voidingSaleId.value);
    if (sale) sale.status = "voided";
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    voidError.value = fetchError.data?.error ?? "Error al anular la venta";
  }

  showVoidModal.value = false;
  voidingSaleId.value = null;
  voidReason.value = "";
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">Historial de ventas</h1>
      <NuxtLink
        to="/sales"
        class="rounded-lg bg-nova-primary px-4 py-2 text-sm font-medium text-white"
      >
        + Nueva venta
      </NuxtLink>
    </div>

    <!-- Filters -->
    <div class="mb-4 flex gap-3">
      <input
        v-model="dateFilter"
        type="date"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <select
        v-model="methodFilter"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option :value="null">Todos los metodos</option>
        <option value="efectivo">Efectivo</option>
        <option value="pago_movil">Pago Movil</option>
        <option value="binance">Binance</option>
        <option value="zinli">Zinli</option>
        <option value="transferencia">Transferencia</option>
        <option value="zelle">Zelle</option>
        <option value="fiado">Fiado</option>
      </select>
    </div>

    <!-- Void error -->
    <p v-if="voidError" class="mb-4 text-sm text-red-500">{{ voidError }}</p>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando ventas...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
      <button
        class="mt-2 block w-full text-xs font-medium text-red-700 underline"
        @click="fetchSales"
      >
        Reintentar
      </button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="salesList.length === 0"
      class="py-12 text-center text-gray-400"
    >
      No hay ventas{{ dateFilter ? " en esta fecha" : "" }}
    </div>

    <template v-else>
      <!-- Desktop: Table -->
      <div
        v-if="isDesktop"
        class="overflow-hidden rounded-xl bg-white shadow-sm"
      >
        <table class="w-full text-left text-sm">
          <thead class="border-b border-gray-200 bg-gray-50">
            <tr>
              <th class="px-4 py-3 font-medium text-gray-500">Fecha</th>
              <th class="px-4 py-3 text-right font-medium text-gray-500">
                Total
              </th>
              <th class="px-4 py-3 font-medium text-gray-500">Estado</th>
              <th v-if="isAdmin" class="px-4 py-3" />
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="sale in salesList"
              :key="sale.id"
              class="hover:bg-gray-50"
              :class="{ 'opacity-50': sale.status === 'voided' }"
            >
              <td class="px-4 py-3 text-gray-700">
                {{ formatDate(sale.createdAt) }}
              </td>
              <td class="px-4 py-3 text-right font-medium text-gray-900">
                ${{ Number(sale.totalUsd).toFixed(2) }}
                <span v-if="sale.totalBs" class="text-xs text-gray-400">
                  Bs.{{ Number(sale.totalBs).toFixed(2) }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="
                    sale.status === 'voided'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  "
                >
                  {{ sale.status === "voided" ? "Anulada" : "Completada" }}
                </span>
              </td>
              <td v-if="isAdmin" class="px-4 py-3">
                <button
                  v-if="sale.status === 'completed'"
                  class="text-xs text-red-500 hover:text-red-700"
                  @click="requestVoid(sale.id)"
                >
                  Anular
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile: Card list -->
      <div v-else class="space-y-2">
        <div
          v-for="sale in salesList"
          :key="sale.id"
          class="rounded-xl bg-white p-4 shadow-sm"
          :class="{ 'opacity-50': sale.status === 'voided' }"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-gray-900">
                ${{ Number(sale.totalUsd).toFixed(2) }}
              </p>
              <p class="text-xs text-gray-500">
                {{ formatDate(sale.createdAt) }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="
                  sale.status === 'voided'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                "
              >
                {{ sale.status === "voided" ? "Anulada" : "Completada" }}
              </span>
              <button
                v-if="isAdmin && sale.status === 'completed'"
                class="text-xs text-red-500"
                @click="requestVoid(sale.id)"
              >
                Anular
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <p
        v-if="totalSales > limit"
        class="mt-4 text-center text-xs text-gray-400"
      >
        Mostrando {{ salesList.length }} de {{ totalSales }} ventas
      </p>
    </template>

    <!-- Step 1: Void reason modal -->
    <Teleport to="body">
      <div
        v-if="showReasonModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showReasonModal = false"
      >
        <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="mb-1 text-lg font-semibold text-gray-900">
            Motivo de anulacion
          </h3>
          <p class="mb-4 text-sm text-gray-500">
            Indica por que se anula esta venta
          </p>

          <!-- Quick reason buttons -->
          <div class="mb-3 flex flex-wrap gap-2">
            <button
              v-for="reason in commonReasons"
              :key="reason"
              class="rounded-full border px-3 py-1 text-xs transition-colors"
              :class="
                voidReason === reason
                  ? 'border-nova-primary bg-blue-50 text-nova-primary'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              "
              @click="voidReason = reason"
            >
              {{ reason }}
            </button>
          </div>

          <!-- Custom reason input -->
          <textarea
            v-model="voidReason"
            rows="2"
            placeholder="O escribe el motivo..."
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
          />

          <div class="mt-4 flex gap-3">
            <button
              class="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
              @click="showReasonModal = false"
            >
              Cancelar
            </button>
            <button
              class="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white disabled:opacity-50"
              :disabled="!voidReason.trim()"
              @click="confirmReason"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Step 2: Owner PIN modal for voiding -->
    <SharedOwnerPinModal
      v-model="showVoidModal"
      action-label="Anular esta venta requiere PIN del dueno"
      @verified="handleVoidConfirmed"
    />
  </div>
</template>
