<script setup lang="ts">
/**
 * Accounts page - receivable/payable with WhatsApp collection.
 *
 * Connected to:
 * - GET /api/accounts/receivable
 * - GET /api/accounts/payable
 * - POST /api/accounts/receivable/:id/payment
 * - POST /api/accounts/receivable/collect-all
 */

import { calculateAgingColor } from "@nova/shared";
import type { AgingColor } from "@nova/shared";

definePageMeta({ middleware: ["admin-only"] });

const { $api } = useApi();

const activeTab = ref<"receivable" | "payable">("receivable");
const isLoading = ref(true);
const loadError = ref("");

const agingColors: Record<AgingColor, string> = {
  green: "text-green-600 bg-green-50",
  yellow: "text-yellow-600 bg-yellow-50",
  red: "text-red-600 bg-red-50",
};

interface Receivable {
  id: string;
  customerId: string;
  balanceUsd: string;
  amountUsd: string;
  paidUsd: string;
  createdAt: string;
}

interface Payable {
  id: string;
  supplierName: string;
  description: string | null;
  amountUsd: string;
  balanceUsd: string;
  status: string;
}

const receivables = ref<Receivable[]>([]);
const payables = ref<Payable[]>([]);
const totalReceivable = ref(0);
const totalPayable = ref(0);

/** Collection links from API. */
interface CollectionLink {
  customerName: string;
  amount: number;
  whatsappUrl: string;
}

async function loadAccounts() {
  isLoading.value = true;
  loadError.value = "";

  try {
    const [recResult, payResult] = await Promise.all([
      $api<{ accounts: Receivable[]; totalPending: number }>(
        "/api/accounts/receivable",
      ),
      $api<{ accounts: Payable[]; totalPending: number }>(
        "/api/accounts/payable",
      ),
    ]);

    receivables.value = recResult.accounts;
    totalReceivable.value = recResult.totalPending;
    payables.value = payResult.accounts;
    totalPayable.value = payResult.totalPending;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando cuentas";
    loadError.value = message;
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadAccounts();
});

function daysSince(d: string): number {
  return Math.floor(
    (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24),
  );
}

async function collectAll() {
  try {
    const result = await $api<{
      links: CollectionLink[];
    }>("/api/accounts/receivable/collect-all", { method: "POST" });

    // Open WhatsApp links for each customer
    for (const link of result.links) {
      window.open(link.whatsappUrl, "_blank");
    }
  } catch {
    // Non-critical: user can collect manually
  }
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">Cuentas</h1>
      <div v-if="!isLoading" class="text-sm text-gray-500">
        Balance: ${{ (totalReceivable - totalPayable).toFixed(2) }}
      </div>
    </div>

    <div class="mb-4 flex rounded-lg bg-gray-100 p-1">
      <button
        class="flex-1 rounded-md py-2 text-sm font-medium transition-colors"
        :class="
          activeTab === 'receivable'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500'
        "
        @click="activeTab = 'receivable'"
      >
        Por cobrar (${{ totalReceivable.toFixed(2) }})
      </button>
      <button
        class="flex-1 rounded-md py-2 text-sm font-medium transition-colors"
        :class="
          activeTab === 'payable'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500'
        "
        @click="activeTab = 'payable'"
      >
        Por pagar (${{ totalPayable.toFixed(2) }})
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando cuentas...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
      <button
        class="mt-2 block w-full text-xs font-medium text-red-700 underline"
        @click="loadAccounts"
      >
        Reintentar
      </button>
    </div>

    <template v-else>
      <!-- Receivable tab -->
      <div v-if="activeTab === 'receivable'" class="space-y-3">
        <button
          v-if="receivables.length > 0"
          class="w-full rounded-xl bg-green-600 py-3 text-sm font-medium text-white"
          @click="collectAll"
        >
          Cobrar a todos los pendientes
        </button>

        <div
          v-if="receivables.length === 0"
          class="py-8 text-center text-gray-400"
        >
          No hay cuentas por cobrar
        </div>

        <div
          v-for="a in receivables"
          :key="a.id"
          class="rounded-xl bg-white p-4 shadow-sm"
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="agingColors[calculateAgingColor(a.createdAt)]"
                >
                  {{ daysSince(a.createdAt) }}d
                </span>
                <p class="font-medium text-gray-900">{{ a.customerId }}</p>
              </div>
              <p class="mt-0.5 text-xs text-gray-500">
                Debe ${{ Number(a.balanceUsd).toFixed(2) }} de ${{
                  Number(a.amountUsd).toFixed(2)
                }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Payable tab -->
      <div v-if="activeTab === 'payable'" class="space-y-3">
        <div
          v-if="payables.length === 0"
          class="py-8 text-center text-gray-400"
        >
          No hay cuentas por pagar
        </div>

        <div
          v-for="a in payables"
          :key="a.id"
          class="rounded-xl bg-white p-4 shadow-sm"
          :class="{ 'opacity-50': a.status === 'paid' }"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-gray-900">{{ a.supplierName }}</p>
              <p class="text-xs text-gray-500">{{ a.description }}</p>
            </div>
            <div class="text-right">
              <p
                class="font-medium"
                :class="a.status === 'paid' ? 'text-gray-400' : 'text-gray-900'"
              >
                ${{ Number(a.balanceUsd).toFixed(2) }}
              </p>
              <span
                class="text-xs"
                :class="
                  a.status === 'paid' ? 'text-green-600' : 'text-orange-600'
                "
              >
                {{ a.status === "paid" ? "Pagado" : "Pendiente" }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
