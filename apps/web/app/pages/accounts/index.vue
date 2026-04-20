<script setup lang="ts">
/**
 * Accounts page - receivable/payable with full CRUD.
 *
 * Connected to:
 * - GET /api/accounts/receivable
 * - POST /api/accounts/receivable/:id/payment
 * - POST /api/accounts/receivable/collect-all
 * - GET /api/accounts/payable
 * - POST /api/accounts/payable
 * - PATCH /api/accounts/payable/:id/pay
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

/** Payment modal for receivables. */
const showPaymentModal = ref(false);
const paymentTargetId = ref("");
const paymentTargetBalance = ref(0);
const paymentAmount = ref("");
const paymentMethod = ref("efectivo");
const paymentReference = ref("");
const paymentSubmitting = ref(false);
const paymentError = ref("");

/** Create payable modal. */
const showCreatePayable = ref(false);
const newPayable = reactive({
  supplierName: "",
  description: "",
  amountUsd: 0,
});
const createPayableSubmitting = ref(false);
const createPayableError = ref("");

/** Pay payable modal. */
const showPayPayable = ref(false);
const payPayableId = ref("");
const payPayableBalance = ref(0);
const payPayableAmount = ref("");
const payPayableSubmitting = ref(false);
const payPayableError = ref("");

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
      links: Array<{ whatsappUrl: string }>;
    }>("/api/accounts/receivable/collect-all", { method: "POST" });
    for (const link of result.links) {
      window.open(link.whatsappUrl, "_blank");
    }
  } catch {
    // Non-critical
  }
}

/** Open payment modal for a receivable. */
function openPayment(rec: Receivable) {
  paymentTargetId.value = rec.id;
  paymentTargetBalance.value = Number(rec.balanceUsd);
  paymentAmount.value = rec.balanceUsd;
  paymentMethod.value = "efectivo";
  paymentReference.value = "";
  paymentError.value = "";
  showPaymentModal.value = true;
}

/** Record payment on receivable. */
async function submitPayment() {
  const amount = Number(paymentAmount.value);
  if (!amount || amount <= 0) {
    paymentError.value = "Monto debe ser mayor a 0";
    return;
  }
  paymentSubmitting.value = true;
  paymentError.value = "";
  try {
    await $api(`/api/accounts/receivable/${paymentTargetId.value}/payment`, {
      method: "POST",
      body: {
        amountUsd: amount,
        method: paymentMethod.value,
        reference: paymentReference.value || undefined,
      },
    });
    showPaymentModal.value = false;
    await loadAccounts();
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    paymentError.value = fetchError.data?.error ?? "Error registrando pago";
  } finally {
    paymentSubmitting.value = false;
  }
}

/** Create a new account payable. */
async function submitCreatePayable() {
  if (!newPayable.supplierName.trim() || newPayable.amountUsd <= 0) {
    createPayableError.value = "Proveedor y monto son obligatorios";
    return;
  }
  createPayableSubmitting.value = true;
  createPayableError.value = "";
  try {
    await $api("/api/accounts/payable", {
      method: "POST",
      body: {
        supplierName: newPayable.supplierName.trim(),
        description: newPayable.description || undefined,
        amountUsd: newPayable.amountUsd,
        balanceUsd: newPayable.amountUsd,
      },
    });
    showCreatePayable.value = false;
    newPayable.supplierName = "";
    newPayable.description = "";
    newPayable.amountUsd = 0;
    await loadAccounts();
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    createPayableError.value = fetchError.data?.error ?? "Error creando deuda";
  } finally {
    createPayableSubmitting.value = false;
  }
}

/** Open pay modal for a payable. */
function openPayPayable(pay: Payable) {
  payPayableId.value = pay.id;
  payPayableBalance.value = Number(pay.balanceUsd);
  payPayableAmount.value = pay.balanceUsd;
  payPayableError.value = "";
  showPayPayable.value = true;
}

/** Record payment on payable. */
async function submitPayPayable() {
  const amount = Number(payPayableAmount.value);
  if (!amount || amount <= 0) {
    payPayableError.value = "Monto debe ser mayor a 0";
    return;
  }
  payPayableSubmitting.value = true;
  payPayableError.value = "";
  try {
    await $api(`/api/accounts/payable/${payPayableId.value}/pay`, {
      method: "PATCH",
      body: { amountUsd: amount },
    });
    showPayPayable.value = false;
    await loadAccounts();
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    payPayableError.value = fetchError.data?.error ?? "Error registrando pago";
  } finally {
    payPayableSubmitting.value = false;
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
        :class="activeTab === 'receivable' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'"
        @click="activeTab = 'receivable'"
      >
        Por cobrar (${{ totalReceivable.toFixed(2) }})
      </button>
      <button
        class="flex-1 rounded-md py-2 text-sm font-medium transition-colors"
        :class="activeTab === 'payable' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'"
        @click="activeTab = 'payable'"
      >
        Por pagar (${{ totalPayable.toFixed(2) }})
      </button>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando cuentas...
    </div>

    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
      <button class="mt-2 block w-full text-xs font-medium text-red-700 underline" @click="loadAccounts">
        Reintentar
      </button>
    </div>

    <template v-else>
      <!-- RECEIVABLE TAB -->
      <div v-if="activeTab === 'receivable'" class="space-y-3">
        <button
          v-if="receivables.length > 0"
          class="w-full rounded-xl bg-green-600 py-3 text-sm font-medium text-white"
          @click="collectAll"
        >
          Cobrar a todos por WhatsApp
        </button>

        <div v-if="receivables.length === 0" class="py-8 text-center text-gray-400">
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
                <p class="font-medium text-gray-900">
                  ${{ Number(a.balanceUsd).toFixed(2) }}
                </p>
              </div>
              <p class="mt-0.5 text-xs text-gray-500">
                Total ${{ Number(a.amountUsd).toFixed(2) }} · Pagado ${{ Number(a.paidUsd).toFixed(2) }}
              </p>
            </div>
            <button
              class="rounded-lg bg-nova-primary px-3 py-1.5 text-xs font-medium text-white"
              @click="openPayment(a)"
            >
              Abonar
            </button>
          </div>
        </div>
      </div>

      <!-- PAYABLE TAB -->
      <div v-if="activeTab === 'payable'" class="space-y-3">
        <button
          class="w-full rounded-xl bg-nova-primary py-3 text-sm font-medium text-white"
          @click="showCreatePayable = true"
        >
          + Nueva deuda por pagar
        </button>

        <div v-if="payables.length === 0" class="py-8 text-center text-gray-400">
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
              <p class="text-xs text-gray-500">
                {{ a.description ?? "" }} · ${{ Number(a.balanceUsd).toFixed(2) }} pendiente
              </p>
            </div>
            <button
              v-if="a.status !== 'paid'"
              class="rounded-lg bg-nova-primary px-3 py-1.5 text-xs font-medium text-white"
              @click="openPayPayable(a)"
            >
              Pagar
            </button>
            <span v-else class="text-xs font-medium text-green-600">Pagado</span>
          </div>
        </div>
      </div>
    </template>

    <!-- PAYMENT MODAL (receivable) -->
    <Teleport to="body">
      <div
        v-if="showPaymentModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showPaymentModal = false"
      >
        <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="mb-1 text-lg font-semibold text-gray-900">Registrar abono</h3>
          <p class="mb-4 text-sm text-gray-500">
            Saldo pendiente: ${{ paymentTargetBalance.toFixed(2) }}
          </p>
          <div class="space-y-3">
            <div>
              <label class="mb-1 block text-sm text-gray-600">Monto ($)</label>
              <input
                v-model="paymentAmount"
                type="number"
                step="0.01"
                min="0"
                :max="paymentTargetBalance"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
                autofocus
              >
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600">Metodo</label>
              <select
                v-model="paymentMethod"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              >
                <option value="efectivo">Efectivo</option>
                <option value="pago_movil">Pago Movil</option>
                <option value="transferencia">Transferencia</option>
                <option value="binance">Binance</option>
                <option value="zelle">Zelle</option>
                <option value="zinli">Zinli</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600">Referencia (opcional)</label>
              <input
                v-model="paymentReference"
                type="text"
                placeholder="Numero de referencia"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              >
            </div>
          </div>
          <p v-if="paymentError" class="mt-2 text-sm text-red-500">{{ paymentError }}</p>
          <div class="mt-4 flex gap-3">
            <button
              class="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
              @click="showPaymentModal = false"
            >
              Cancelar
            </button>
            <button
              class="flex-1 rounded-lg bg-nova-primary py-2 text-sm font-medium text-white disabled:opacity-50"
              :disabled="paymentSubmitting"
              @click="submitPayment"
            >
              {{ paymentSubmitting ? "Guardando..." : "Registrar abono" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- CREATE PAYABLE MODAL -->
    <Teleport to="body">
      <div
        v-if="showCreatePayable"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showCreatePayable = false"
      >
        <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="mb-4 text-lg font-semibold text-gray-900">Nueva deuda por pagar</h3>
          <div class="space-y-3">
            <div>
              <label class="mb-1 block text-sm text-gray-600">Proveedor *</label>
              <input
                v-model="newPayable.supplierName"
                type="text"
                placeholder="Nombre del proveedor"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
                autofocus
              >
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600">Monto ($) *</label>
              <input
                v-model.number="newPayable.amountUsd"
                type="number"
                step="0.01"
                min="0"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              >
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600">Descripcion</label>
              <input
                v-model="newPayable.description"
                type="text"
                placeholder="Opcional"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              >
            </div>
          </div>
          <p v-if="createPayableError" class="mt-2 text-sm text-red-500">{{ createPayableError }}</p>
          <div class="mt-4 flex gap-3">
            <button
              class="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
              @click="showCreatePayable = false"
            >
              Cancelar
            </button>
            <button
              class="flex-1 rounded-lg bg-nova-primary py-2 text-sm font-medium text-white disabled:opacity-50"
              :disabled="createPayableSubmitting"
              @click="submitCreatePayable"
            >
              {{ createPayableSubmitting ? "Guardando..." : "Crear deuda" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- PAY PAYABLE MODAL -->
    <Teleport to="body">
      <div
        v-if="showPayPayable"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showPayPayable = false"
      >
        <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="mb-1 text-lg font-semibold text-gray-900">Registrar pago</h3>
          <p class="mb-4 text-sm text-gray-500">
            Saldo pendiente: ${{ payPayableBalance.toFixed(2) }}
          </p>
          <div>
            <label class="mb-1 block text-sm text-gray-600">Monto ($)</label>
            <input
              v-model="payPayableAmount"
              type="number"
              step="0.01"
              min="0"
              :max="payPayableBalance"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              autofocus
            >
          </div>
          <p v-if="payPayableError" class="mt-2 text-sm text-red-500">{{ payPayableError }}</p>
          <div class="mt-4 flex gap-3">
            <button
              class="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
              @click="showPayPayable = false"
            >
              Cancelar
            </button>
            <button
              class="flex-1 rounded-lg bg-nova-primary py-2 text-sm font-medium text-white disabled:opacity-50"
              :disabled="payPayableSubmitting"
              @click="submitPayPayable"
            >
              {{ payPayableSubmitting ? "Guardando..." : "Registrar pago" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
