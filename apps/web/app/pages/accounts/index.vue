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
import { MessageCircle, Plus } from "lucide-vue-next";



const { $api } = useApi();

const activeTab = ref<"receivable" | "payable">("receivable");
const isLoading = ref(true);
const loadError = ref("");

const agingBadge: Record<AgingColor, string> = {
  green: "bg-green-50 text-green-700",
  yellow: "bg-yellow-50 text-yellow-700",
  red: "bg-red-50 text-red-700",
};

interface Receivable {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  balanceUsd: string;
  amountUsd: string;
  paidUsd: string;
  dueDate: string | null;
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
  supplierId: null as string | null,
  supplierName: "",
  description: "",
  amountUsd: 0,
});
const createPayableSubmitting = ref(false);
const createPayableError = ref("");

// Supplier search for payable creation
interface SupplierOption {
  id: string;
  name: string;
  phone: string | null;
}
const supplierQuery = ref("");
const supplierResults = ref<SupplierOption[]>([]);
const isSearchingSuppliers = ref(false);
const showSupplierDropdown = ref(false);
let supplierSearchTimer: ReturnType<typeof setTimeout> | null = null;

function onSupplierInput() {
  newPayable.supplierId = null;
  newPayable.supplierName = supplierQuery.value;
  if (supplierSearchTimer) clearTimeout(supplierSearchTimer);

  const q = supplierQuery.value.trim();
  if (q.length < 2) {
    supplierResults.value = [];
    showSupplierDropdown.value = false;
    return;
  }

  supplierSearchTimer = setTimeout(async () => {
    isSearchingSuppliers.value = true;
    try {
      const result = await $api<{ suppliers: SupplierOption[] }>(
        `/api/suppliers?search=${encodeURIComponent(q)}`,
      );
      supplierResults.value = result.suppliers;
      showSupplierDropdown.value = result.suppliers.length > 0;
    } catch {
      supplierResults.value = [];
    } finally {
      isSearchingSuppliers.value = false;
    }
  }, 250);
}

function selectSupplier(s: SupplierOption) {
  newPayable.supplierId = s.id;
  newPayable.supplierName = s.name;
  supplierQuery.value = s.name;
  showSupplierDropdown.value = false;
}

function clearSupplier() {
  newPayable.supplierId = null;
  newPayable.supplierName = "";
  supplierQuery.value = "";
  supplierResults.value = [];
  showSupplierDropdown.value = false;
}

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

onMounted(async () => {
  await useOwnerLockRedirect();
  loadAccounts();
});

function daysSince(d: string): number {
  return Math.floor(
    (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24),
  );
}

/** Build a wa.me link for collecting a specific receivable. */
function collectLink(rec: Receivable): string | null {
  if (!rec.customerPhone) return null;
  const phone = rec.customerPhone.replace(/[^0-9]/g, "");
  if (!phone) return null;
  const amount = Number(rec.balanceUsd).toFixed(2);
  const text = encodeURIComponent(
    `Hola ${rec.customerName}, tienes un saldo pendiente de $${amount}. ¿Cuando puedes realizar el pago? Gracias!`,
  );
  return `https://wa.me/${phone}?text=${text}`;
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
        supplierId: newPayable.supplierId || undefined,
        supplierName: newPayable.supplierName.trim(),
        description: newPayable.description || undefined,
        amountUsd: newPayable.amountUsd,
      },
    });
    showCreatePayable.value = false;
    clearSupplier();
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
      <h1 class="text-2xl font-extrabold tracking-tight text-gradient">Cuentas</h1>
      <div v-if="!isLoading" class="glass rounded-2xl px-4 py-2 text-sm font-bold text-gray-700">
        Balance: ${{ (totalReceivable - totalPayable).toFixed(2) }}
      </div>
    </div>

    <!-- Tab switcher -->
    <div class="glass mb-4 flex rounded-2xl p-1">
      <button
        class="flex-1 rounded-xl py-2.5 text-sm font-bold transition-spring"
        :class="activeTab === 'receivable' ? 'dark-pill' : 'text-gray-500 hover:text-gray-700'"
        @click="activeTab = 'receivable'"
      >
        Por cobrar (${{ totalReceivable.toFixed(2) }})
      </button>
      <button
        class="flex-1 rounded-xl py-2.5 text-sm font-bold transition-spring"
        :class="activeTab === 'payable' ? 'dark-pill' : 'text-gray-500 hover:text-gray-700'"
        @click="activeTab = 'payable'"
      >
        Por pagar (${{ totalPayable.toFixed(2) }})
      </button>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary" />
      Cargando cuentas...
    </div>

    <div
      v-else-if="loadError"
      class="card-premium p-6 text-center"
    >
      <p class="text-sm font-semibold text-red-500">{{ loadError }}</p>
      <button class="mt-3 text-xs font-bold text-nova-primary underline" @click="loadAccounts">
        Reintentar
      </button>
    </div>

    <template v-else>
      <!-- RECEIVABLE TAB -->
      <div v-if="activeTab === 'receivable'" class="space-y-3">
        <div v-if="receivables.length === 0" class="card-premium py-8 text-center">
          <p class="text-sm font-medium text-gray-400">No hay cuentas por cobrar</p>
        </div>

        <div
          v-for="a in receivables"
          :key="a.id"
          class="card-premium p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-gray-800">{{ a.customerName }}</p>
              <div class="mt-1 flex items-center gap-2">
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  :class="agingBadge[calculateAgingColor(a.createdAt)]"
                >
                  {{ daysSince(a.createdAt) }}d
                </span>
                <p class="text-lg font-extrabold text-gray-800">
                  ${{ Number(a.balanceUsd).toFixed(2) }}
                </p>
              </div>
              <p class="mt-0.5 text-xs font-medium text-gray-500">
                Total ${{ Number(a.amountUsd).toFixed(2) }} · Pagado ${{ Number(a.paidUsd).toFixed(2) }}
              </p>
              <p
                v-if="a.dueDate"
                class="mt-0.5 text-[10px] font-semibold"
                :class="new Date(a.dueDate) <= new Date() ? 'text-red-500' : 'text-gray-400'"
              >
                Vence: {{ new Date(a.dueDate).toLocaleDateString("es-VE", { timeZone: "America/Caracas", day: "numeric", month: "short" }) }}
              </p>
            </div>
            <div class="flex flex-shrink-0 gap-2">
              <a
                v-if="collectLink(a)"
                :href="collectLink(a)!"
                target="_blank"
                rel="noopener noreferrer"
                class="flex h-9 w-9 items-center justify-center rounded-xl bg-green-600 text-white transition-spring hover:bg-green-700"
                title="Cobrar por WhatsApp"
              >
                <MessageCircle :size="16" />
              </a>
              <button
                class="dark-pill rounded-2xl px-4 py-2 text-xs font-bold transition-spring"
                @click="openPayment(a)"
              >
                Abonar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- PAYABLE TAB -->
      <div v-if="activeTab === 'payable'" class="space-y-3">
        <button
          class="dark-pill flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-spring"
          @click="showCreatePayable = true"
        >
          <Plus :size="16" />
          Nueva deuda por pagar
        </button>

        <div v-if="payables.length === 0" class="card-premium py-8 text-center">
          <p class="text-sm font-medium text-gray-400">No hay cuentas por pagar</p>
        </div>

        <div
          v-for="a in payables"
          :key="a.id"
          class="card-premium p-4"
          :class="{ 'opacity-40': a.status === 'paid' }"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="font-bold text-gray-800">{{ a.supplierName }}</p>
              <p class="text-xs font-medium text-gray-500">
                {{ a.description ?? "" }} · ${{ Number(a.balanceUsd).toFixed(2) }} pendiente
              </p>
            </div>
            <button
              v-if="a.status !== 'paid'"
              class="dark-pill rounded-2xl px-4 py-2 text-xs font-bold transition-spring"
              @click="openPayPayable(a)"
            >
              Pagar
            </button>
            <span v-else class="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-bold text-green-600">Pagado</span>
          </div>
        </div>
      </div>
    </template>

    <!-- PAYMENT MODAL (receivable) -->
    <Teleport to="body">
      <div
        v-if="showPaymentModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showPaymentModal = false"
      >
        <div class="glass-strong w-full max-w-sm rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
          <h3 class="mb-1 text-xl font-extrabold tracking-tight text-gradient">Registrar abono</h3>
          <p class="mb-5 text-[13px] font-medium text-gray-500">
            Saldo pendiente: ${{ paymentTargetBalance.toFixed(2) }}
          </p>
          <div class="space-y-4">
            <div>
              <label class="mb-1.5 block text-[13px] font-bold text-gray-600">Monto ($)</label>
              <input
                v-model="paymentAmount"
                type="number"
                step="0.01"
                min="0"
                :max="paymentTargetBalance"
                class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
                autofocus
              >
            </div>
            <div>
              <label class="mb-1.5 block text-[13px] font-bold text-gray-600">Metodo</label>
              <select
                v-model="paymentMethod"
                class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 outline-none transition-spring focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
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
              <label class="mb-1.5 block text-[13px] font-bold text-gray-600">Referencia (opcional)</label>
              <input
                v-model="paymentReference"
                type="text"
                placeholder="Numero de referencia"
                class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
              >
            </div>
          </div>
          <p v-if="paymentError" class="mt-3 text-sm font-semibold text-red-500">{{ paymentError }}</p>
          <div class="mt-5 flex gap-3">
            <button
              class="glass flex-1 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
              @click="showPaymentModal = false"
            >
              Cancelar
            </button>
            <button
              class="dark-pill flex-1 rounded-2xl py-3 text-sm font-bold transition-spring disabled:opacity-50"
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
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showCreatePayable = false"
      >
        <div class="glass-strong w-full max-w-sm rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
          <h3 class="mb-5 text-xl font-extrabold tracking-tight text-gradient">Nueva deuda por pagar</h3>
          <div class="space-y-4">
            <div>
              <label class="mb-1.5 block text-[13px] font-bold text-gray-600">Proveedor *</label>

              <!-- Selected supplier display -->
              <div
                v-if="newPayable.supplierId"
                class="flex items-center justify-between rounded-2xl border border-green-300 bg-green-50 px-4 py-3"
              >
                <div>
                  <p class="text-sm font-bold text-gray-800">{{ newPayable.supplierName }}</p>
                  <p class="text-[11px] font-medium text-green-700">Proveedor seleccionado</p>
                </div>
                <button
                  class="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-spring hover:bg-red-50 hover:text-red-500"
                  @click="clearSupplier"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              <!-- Supplier search input -->
              <div v-else class="relative">
                <input
                  v-model="supplierQuery"
                  type="text"
                  placeholder="Buscar proveedor por nombre..."
                  class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
                  autofocus
                  @input="onSupplierInput"
                  @focus="showSupplierDropdown = supplierResults.length > 0"
                >
                <div
                  v-if="isSearchingSuppliers"
                  class="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <div class="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary" />
                </div>

                <!-- Search results dropdown -->
                <div
                  v-if="showSupplierDropdown"
                  class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg"
                >
                  <button
                    v-for="s in supplierResults"
                    :key="s.id"
                    class="flex w-full items-center justify-between px-4 py-3 text-left transition-spring hover:bg-gray-50"
                    @mousedown.prevent="selectSupplier(s)"
                  >
                    <div>
                      <p class="text-sm font-semibold text-gray-800">{{ s.name }}</p>
                      <p v-if="s.phone" class="text-[11px] text-gray-500">{{ s.phone }}</p>
                    </div>
                  </button>
                </div>

                <!-- Hint: can also type a new name -->
                <p
                  v-if="supplierQuery.length >= 2 && !isSearchingSuppliers && supplierResults.length === 0"
                  class="mt-1.5 text-[11px] font-medium text-gray-400"
                >
                  No encontrado. Se usara "{{ supplierQuery }}" como nombre.
                </p>
              </div>
            </div>
            <div>
              <label class="mb-1.5 block text-[13px] font-bold text-gray-600">Monto ($) *</label>
              <input
                v-model.number="newPayable.amountUsd"
                type="number"
                step="0.01"
                min="0"
                class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
              >
            </div>
            <div>
              <label class="mb-1.5 block text-[13px] font-bold text-gray-600">Descripcion</label>
              <input
                v-model="newPayable.description"
                type="text"
                placeholder="Opcional"
                class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
              >
            </div>
          </div>
          <p v-if="createPayableError" class="mt-3 text-sm font-semibold text-red-500">{{ createPayableError }}</p>
          <div class="mt-5 flex gap-3">
            <button
              class="glass flex-1 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
              @click="showCreatePayable = false"
            >
              Cancelar
            </button>
            <button
              class="dark-pill flex-1 rounded-2xl py-3 text-sm font-bold transition-spring disabled:opacity-50"
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
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showPayPayable = false"
      >
        <div class="glass-strong w-full max-w-sm rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
          <h3 class="mb-1 text-xl font-extrabold tracking-tight text-gradient">Registrar pago</h3>
          <p class="mb-5 text-[13px] font-medium text-gray-500">
            Saldo pendiente: ${{ payPayableBalance.toFixed(2) }}
          </p>
          <div>
            <label class="mb-1.5 block text-[13px] font-bold text-gray-600">Monto ($)</label>
            <input
              v-model="payPayableAmount"
              type="number"
              step="0.01"
              min="0"
              :max="payPayableBalance"
              class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
              autofocus
            >
          </div>
          <p v-if="payPayableError" class="mt-3 text-sm font-semibold text-red-500">{{ payPayableError }}</p>
          <div class="mt-5 flex gap-3">
            <button
              class="glass flex-1 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
              @click="showPayPayable = false"
            >
              Cancelar
            </button>
            <button
              class="dark-pill flex-1 rounded-2xl py-3 text-sm font-bold transition-spring disabled:opacity-50"
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
