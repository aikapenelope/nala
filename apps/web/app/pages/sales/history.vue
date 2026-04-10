<script setup lang="ts">
/**
 * Sales history page.
 *
 * Desktop: filterable table with date, seller, payment method, product.
 * Mobile: card list grouped by date.
 *
 * Features:
 * - Filter by date range, seller, payment method
 * - Sale detail on tap
 * - Void sale with owner PIN (admin only)
 * - Offline queue indicator
 */

const { isDesktop } = useDevice();
const { isAdmin } = useNovaAuth();

const dateFilter = ref("");
const methodFilter = ref<string | null>(null);

/** Pending offline sales count. */
const pendingCount = ref(0);

/** Mock sales for UI development. */
const sales = ref([
  {
    id: "s1",
    date: "2026-04-15T14:30:00Z",
    seller: "María García",
    items: 3,
    totalUsd: 12.5,
    totalBs: 456.25,
    method: "efectivo",
    status: "completed" as const,
  },
  {
    id: "s2",
    date: "2026-04-15T11:15:00Z",
    seller: "Pedro Rodríguez",
    items: 1,
    totalUsd: 4.5,
    totalBs: 164.25,
    method: "pago_movil",
    status: "completed" as const,
  },
  {
    id: "s3",
    date: "2026-04-15T09:45:00Z",
    seller: "María García",
    items: 5,
    totalUsd: 28.0,
    totalBs: 1022.0,
    method: "fiado",
    status: "completed" as const,
  },
  {
    id: "s4",
    date: "2026-04-14T16:00:00Z",
    seller: "Pedro Rodríguez",
    items: 2,
    totalUsd: 8.0,
    totalBs: 292.0,
    method: "binance",
    status: "voided" as const,
  },
]);

/** Payment method display labels. */
const methodLabels: Record<string, string> = {
  efectivo: "Efectivo",
  pago_movil: "Pago Móvil",
  binance: "Binance",
  zinli: "Zinli",
  transferencia: "Transferencia",
  zelle: "Zelle",
  fiado: "Fiado",
};

/** Format date for display. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Filtered sales. */
const filteredSales = computed(() => {
  return sales.value.filter((s) => {
    if (methodFilter.value && s.method !== methodFilter.value) return false;
    if (dateFilter.value) {
      const saleDate = s.date.split("T")[0];
      if (saleDate !== dateFilter.value) return false;
    }
    return true;
  });
});

/** Show void confirmation modal. */
const showVoidModal = ref(false);
const voidingSaleId = ref<string | null>(null);

function requestVoid(saleId: string) {
  voidingSaleId.value = saleId;
  showVoidModal.value = true;
}

function handleVoidConfirmed() {
  if (voidingSaleId.value) {
    const sale = sales.value.find((s) => s.id === voidingSaleId.value);
    if (sale) sale.status = "voided";
  }
  showVoidModal.value = false;
  voidingSaleId.value = null;
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

    <!-- Offline queue indicator -->
    <div
      v-if="pendingCount > 0"
      class="mb-4 flex items-center gap-2 rounded-lg bg-yellow-50 px-4 py-2"
    >
      <span class="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
      <span class="text-sm text-yellow-700">
        {{ pendingCount }} venta{{ pendingCount > 1 ? "s" : "" }} pendiente{{
          pendingCount > 1 ? "s" : ""
        }}
        de sincronizar
      </span>
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
        <option :value="null">Todos los métodos</option>
        <option value="efectivo">Efectivo</option>
        <option value="pago_movil">Pago Móvil</option>
        <option value="binance">Binance</option>
        <option value="zinli">Zinli</option>
        <option value="transferencia">Transferencia</option>
        <option value="zelle">Zelle</option>
        <option value="fiado">Fiado</option>
      </select>
    </div>

    <!-- Desktop: Table -->
    <div v-if="isDesktop" class="overflow-hidden rounded-xl bg-white shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-gray-200 bg-gray-50">
          <tr>
            <th class="px-4 py-3 font-medium text-gray-500">Fecha</th>
            <th class="px-4 py-3 font-medium text-gray-500">Vendedor</th>
            <th class="px-4 py-3 font-medium text-gray-500">Items</th>
            <th class="px-4 py-3 font-medium text-gray-500">Método</th>
            <th class="px-4 py-3 font-medium text-gray-500 text-right">
              Total
            </th>
            <th class="px-4 py-3 font-medium text-gray-500">Estado</th>
            <th v-if="isAdmin" class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="sale in filteredSales"
            :key="sale.id"
            class="hover:bg-gray-50"
            :class="{ 'opacity-50': sale.status === 'voided' }"
          >
            <td class="px-4 py-3 text-gray-700">
              {{ formatDate(sale.date) }}
            </td>
            <td class="px-4 py-3 text-gray-700">{{ sale.seller }}</td>
            <td class="px-4 py-3 text-gray-500">{{ sale.items }}</td>
            <td class="px-4 py-3 text-gray-500">
              {{ methodLabels[sale.method] ?? sale.method }}
            </td>
            <td class="px-4 py-3 text-right font-medium text-gray-900">
              ${{ sale.totalUsd.toFixed(2) }}
              <span class="text-xs text-gray-400">
                Bs.{{ sale.totalBs.toFixed(2) }}
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
        v-for="sale in filteredSales"
        :key="sale.id"
        class="rounded-xl bg-white p-4 shadow-sm"
        :class="{ 'opacity-50': sale.status === 'voided' }"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-900">
              ${{ sale.totalUsd.toFixed(2) }}
            </p>
            <p class="text-xs text-gray-500">
              {{ formatDate(sale.date) }} · {{ sale.seller }}
            </p>
          </div>
          <div class="text-right">
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="
                sale.status === 'voided'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              "
            >
              {{ methodLabels[sale.method] ?? sale.method }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Owner PIN modal for voiding -->
    <SharedOwnerPinModal
      v-model="showVoidModal"
      action-label="Anular esta venta requiere PIN del dueño"
      @verified="handleVoidConfirmed"
    />
  </div>
</template>
