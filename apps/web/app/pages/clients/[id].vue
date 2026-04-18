<script setup lang="ts">
/**
 * Customer stats detail page.
 *
 * Shows purchase history, top products, spending trend,
 * and visit frequency for a single customer.
 *
 * Connected to:
 * - GET /api/reports/customer-stats/:id
 * - GET /api/customers/:id
 */

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
    const [custResult, statsResult] = await Promise.all([
      $api<{ customer: CustomerDetail }>(
        `/api/customers/${customerId.value}`,
      ),
      $api<CustomerStats>(
        `/api/reports/customer-stats/${customerId.value}`,
      ),
    ]);

    customer.value = custResult.customer;
    stats.value = statsResult;
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

    <template v-else-if="customer && stats">
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

      <!-- Top products -->
      <div
        v-if="stats.topProducts.length > 0"
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
        v-if="stats.monthlyTrend.length > 0"
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
