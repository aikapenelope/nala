<script setup lang="ts">
/**
 * Supplier account detail page.
 *
 * Shows purchase history, pending payables, and summary stats
 * for a specific supplier.
 *
 * Connected to:
 * - GET /api/suppliers/:id/account
 */

const route = useRoute();
const { $api } = useApi();

const supplierId = computed(() => route.params.id as string);

const isLoading = ref(true);
const loadError = ref("");

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

interface AccountSummary {
  totalPurchases: number;
  purchaseCount: number;
  totalPending: number;
  pendingCount: number;
}

interface RecentExpense {
  id: string;
  date: string;
  total: string;
  invoiceNumber: string | null;
}

const supplier = ref<Supplier | null>(null);
const account = ref<AccountSummary | null>(null);
const recentExpenses = ref<RecentExpense[]>([]);

onMounted(async () => {
  try {
    const result = await $api<{
      supplier: Supplier;
      account: AccountSummary;
      recentExpenses: RecentExpense[];
    }>(`/api/suppliers/${supplierId.value}/account`);

    supplier.value = result.supplier;
    account.value = result.account;
    recentExpenses.value = result.recentExpenses;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando datos del proveedor";
    loadError.value = message;
  } finally {
    isLoading.value = false;
  }
});

/** Format date for display. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">Estado de cuenta</h1>
      <NuxtLink
        to="/more"
        class="text-sm text-gray-500 hover:text-gray-700"
      >
        Volver
      </NuxtLink>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando estado de cuenta...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
    </div>

    <template v-else-if="supplier && account">
      <!-- Supplier header -->
      <div class="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 class="text-lg font-bold text-gray-900">{{ supplier.name }}</h2>
        <div class="mt-1 space-y-0.5 text-sm text-gray-500">
          <p v-if="supplier.phone">{{ supplier.phone }}</p>
          <p v-if="supplier.email">{{ supplier.email }}</p>
          <p v-if="supplier.address">{{ supplier.address }}</p>
        </div>
        <p
          v-if="supplier.notes"
          class="mt-2 text-xs text-gray-400"
        >
          {{ supplier.notes }}
        </p>
      </div>

      <!-- Account summary cards -->
      <div class="mb-6 grid grid-cols-2 gap-4">
        <div class="rounded-xl bg-white p-5 text-center shadow-sm">
          <p class="text-2xl font-bold text-gray-900">
            ${{ account.totalPurchases.toFixed(2) }}
          </p>
          <p class="text-xs text-gray-500">
            Total compras ({{ account.purchaseCount }})
          </p>
        </div>
        <div class="rounded-xl bg-white p-5 text-center shadow-sm">
          <p
            class="text-2xl font-bold"
            :class="
              account.totalPending > 0 ? 'text-red-600' : 'text-green-600'
            "
          >
            ${{ account.totalPending.toFixed(2) }}
          </p>
          <p class="text-xs text-gray-500">
            Deuda pendiente ({{ account.pendingCount }})
          </p>
        </div>
      </div>

      <!-- Recent expenses -->
      <div class="rounded-xl bg-white p-6 shadow-sm">
        <h2 class="mb-4 text-sm font-semibold text-gray-700">
          Compras recientes
        </h2>

        <div v-if="recentExpenses.length > 0" class="space-y-2">
          <div
            v-for="exp in recentExpenses"
            :key="exp.id"
            class="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-sm"
          >
            <div>
              <p class="text-gray-900">
                {{ formatDate(exp.date) }}
              </p>
              <p
                v-if="exp.invoiceNumber"
                class="text-xs text-gray-400"
              >
                Factura #{{ exp.invoiceNumber }}
              </p>
            </div>
            <p class="font-medium text-gray-900">
              ${{ Number(exp.total).toFixed(2) }}
            </p>
          </div>
        </div>
        <p v-else class="text-center text-sm text-gray-400">
          No hay compras registradas con este proveedor
        </p>
      </div>
    </template>
  </div>
</template>
