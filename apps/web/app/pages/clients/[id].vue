<script setup lang="ts">
/**
 * Customer stats detail page.
 *
 * Shows purchase history, top products, spending trend,
 * RFM scoring profile, and visit frequency for a single customer.
 *
 * Connected to:
 * - GET /api/reports/customer-stats/:id
 * - GET /api/customers/:id
 */

import type { RfmSegment } from "@nova/shared";
import { RFM_SEGMENT_LABELS, RFM_SEGMENT_COLORS } from "@nova/shared";

const route = useRoute();
const { $api } = useApi();

const customerId = computed(() => route.params.id as string);

const isLoading = ref(true);
const loadError = ref("");

interface CustomerDetail {
  id: string;
  name: string;
  phone: string | null;
  balanceUsd: string;
  totalPurchases: number;
  totalSpentUsd: string;
  averageTicketUsd: string;
  lastPurchaseAt: string | null;
  rfmRecency: number | null;
  rfmFrequency: number | null;
  rfmMonetary: string | null;
  rfmScore: string | null;
  rfmSegment: RfmSegment | null;
  rfmCalculatedAt: string | null;
}

interface CustomerStats {
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  topProducts: Array<{ name: string; quantity: number; total: number }>;
  monthlyTrend: Array<{ month: string; revenue: number; count: number }>;
}

const customer = ref<CustomerDetail | null>(null);
const stats = ref<CustomerStats | null>(null);

onMounted(async () => {
  try {
    // Load customer detail first (critical)
    const custResult = await $api<{ customer: CustomerDetail }>(
      `/api/customers/${customerId.value}`,
    );
    customer.value = custResult.customer;

    // If this customer has purchases but no RFM score, trigger calculation
    if (customer.value.totalPurchases > 0 && !customer.value.rfmSegment) {
      $api("/api/customers/rfm/recalculate", { method: "POST" })
        .then(async () => {
          // Refresh customer data to show the new RFM score
          const refreshed = await $api<{ customer: CustomerDetail }>(
            `/api/customers/${customerId.value}`,
          );
          customer.value = refreshed.customer;
        })
        .catch(() => {
          // Non-critical: RFM will show on next visit
        });
    }

    // Load stats separately (non-critical — page still works without it)
    try {
      const statsResult = await $api<CustomerStats>(
        `/api/reports/customer-stats/${customerId.value}`,
      );
      stats.value = statsResult;
    } catch {
      // Stats failed but customer loaded — show what we have
      stats.value = null;
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando datos del cliente";
    loadError.value = message;
  } finally {
    isLoading.value = false;
  }
});

/** Format month label. */
function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const names = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  return `${names[Number(m) - 1]} ${year}`;
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">Estadisticas del cliente</h1>
      <NuxtLink
        to="/clients"
        class="text-sm text-gray-500 hover:text-gray-700"
      >
        Volver
      </NuxtLink>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando estadisticas...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
    </div>

    <template v-else-if="customer">
      <!-- Customer header -->
      <div class="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 class="text-lg font-bold text-gray-900">{{ customer.name }}</h2>
        <p v-if="customer.phone" class="text-sm text-gray-500">
          {{ customer.phone }}
        </p>
        <div class="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p class="text-2xl font-bold text-gray-900">
              {{ customer.totalPurchases }}
            </p>
            <p class="text-xs text-gray-500">Compras</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">
              ${{ Number(customer.totalSpentUsd).toFixed(0) }}
            </p>
            <p class="text-xs text-gray-500">Total gastado</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">
              ${{ Number(customer.averageTicketUsd).toFixed(2) }}
            </p>
            <p class="text-xs text-gray-500">Ticket promedio</p>
          </div>
        </div>
        <div
          v-if="Number(customer.balanceUsd) > 0"
          class="mt-4 rounded-lg bg-yellow-50 px-4 py-2 text-center text-sm text-yellow-700"
        >
          Deuda pendiente: ${{ Number(customer.balanceUsd).toFixed(2) }}
        </div>
      </div>

      <!-- RFM Profile -->
      <div
        v-if="customer.rfmSegment"
        class="mb-6 rounded-xl bg-white p-6 shadow-sm"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-700">Perfil RFM</h2>
          <span
            class="rounded-full px-2.5 py-1 text-[11px] font-bold"
            :class="RFM_SEGMENT_COLORS[customer.rfmSegment] ?? 'bg-gray-100 text-gray-500'"
          >
            {{ RFM_SEGMENT_LABELS[customer.rfmSegment] ?? customer.rfmSegment }}
          </span>
        </div>

        <!-- R, F, M bars -->
        <div class="space-y-3">
          <div>
            <div class="mb-1 flex items-center justify-between text-xs">
              <span class="font-medium text-gray-600">Recencia</span>
              <span class="text-gray-400">
                {{ customer.rfmRecency != null ? `${customer.rfmRecency} dias` : '-' }}
              </span>
            </div>
            <div class="h-2 w-full rounded-full bg-gray-100">
              <div
                class="h-2 rounded-full bg-nova-primary transition-all"
                :style="{ width: `${customer.rfmScore ? Number(customer.rfmScore[0]) * 20 : 0}%` }"
              />
            </div>
          </div>
          <div>
            <div class="mb-1 flex items-center justify-between text-xs">
              <span class="font-medium text-gray-600">Frecuencia</span>
              <span class="text-gray-400">
                {{ customer.rfmFrequency != null ? `${customer.rfmFrequency} compras (90d)` : '-' }}
              </span>
            </div>
            <div class="h-2 w-full rounded-full bg-gray-100">
              <div
                class="h-2 rounded-full bg-nova-accent transition-all"
                :style="{ width: `${customer.rfmScore ? Number(customer.rfmScore[1]) * 20 : 0}%` }"
              />
            </div>
          </div>
          <div>
            <div class="mb-1 flex items-center justify-between text-xs">
              <span class="font-medium text-gray-600">Valor monetario</span>
              <span class="text-gray-400">
                {{ customer.rfmMonetary != null ? `$${Number(customer.rfmMonetary).toFixed(0)} (90d)` : '-' }}
              </span>
            </div>
            <div class="h-2 w-full rounded-full bg-gray-100">
              <div
                class="h-2 rounded-full bg-emerald-500 transition-all"
                :style="{ width: `${customer.rfmScore ? Number(customer.rfmScore[2]) * 20 : 0}%` }"
              />
            </div>
          </div>
        </div>

        <p
          v-if="customer.rfmCalculatedAt"
          class="mt-3 text-[10px] text-gray-400"
        >
          Calculado: {{ new Date(customer.rfmCalculatedAt).toLocaleDateString('es-VE') }}
        </p>
      </div>

      <!-- Top products -->
      <div
        v-if="stats && stats.topProducts.length > 0"
        class="mb-6 rounded-xl bg-white p-6 shadow-sm"
      >
        <h2 class="mb-4 text-sm font-semibold text-gray-700">
          Productos mas comprados
        </h2>
        <div class="space-y-2">
          <div
            v-for="(prod, idx) in stats.topProducts.slice(0, 10)"
            :key="idx"
            class="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2 text-sm"
          >
            <span class="text-gray-900">{{ prod.name }}</span>
            <div class="text-right">
              <span class="font-medium text-gray-900">
                ${{ prod.total.toFixed(2) }}
              </span>
              <span class="ml-2 text-xs text-gray-400">
                x{{ prod.quantity }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Monthly trend -->
      <div
        v-if="stats && stats.monthlyTrend.length > 0"
        class="mb-6 rounded-xl bg-white p-6 shadow-sm"
      >
        <h2 class="mb-4 text-sm font-semibold text-gray-700">
          Tendencia de compras (6 meses)
        </h2>
        <div class="space-y-2">
          <div
            v-for="month in stats.monthlyTrend"
            :key="month.month"
            class="flex items-center gap-3"
          >
            <span class="w-16 text-right text-xs text-gray-500">
              {{ formatMonth(month.month) }}
            </span>
            <div class="flex-1">
              <div
                class="h-5 rounded-r bg-nova-primary"
                :style="{
                  width: `${(month.revenue / Math.max(...stats.monthlyTrend.map((m) => m.revenue), 1)) * 100}%`,
                  minWidth: month.revenue > 0 ? '4px' : '0',
                }"
              />
            </div>
            <span class="w-20 text-right text-sm font-medium text-gray-900">
              ${{ month.revenue.toFixed(0) }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
