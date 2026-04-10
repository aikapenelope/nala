<script setup lang="ts">
/**
 * Accounts page - receivable/payable with WhatsApp collection.
 */

import {
  calculateAgingColor,
  generateCollectionWhatsAppUrl,
} from "@nova/shared";
import type { AgingColor } from "@nova/shared";

definePageMeta({ middleware: ["admin-only"] });

const activeTab = ref<"receivable" | "payable">("receivable");

const agingColors: Record<AgingColor, string> = {
  green: "text-green-600 bg-green-50",
  yellow: "text-yellow-600 bg-yellow-50",
  red: "text-red-600 bg-red-50",
};

const receivables = ref([
  {
    id: "ar1",
    customerName: "Juan Pérez",
    customerPhone: "+584125550010",
    amount: 65.0,
    paid: 0,
    balance: 65.0,
    createdAt: "2026-03-10T00:00:00Z",
  },
  {
    id: "ar2",
    customerName: "Pedro López",
    customerPhone: "+584245550030",
    amount: 100.0,
    paid: 30.0,
    balance: 70.0,
    createdAt: "2026-03-25T00:00:00Z",
  },
  {
    id: "ar3",
    customerName: "Ana Rodríguez",
    customerPhone: "+584145550040",
    amount: 25.0,
    paid: 0,
    balance: 25.0,
    createdAt: "2026-04-08T00:00:00Z",
  },
]);

const payables = ref([
  {
    id: "ap1",
    supplierName: "Distribuidora Harina VE",
    description: "Factura #234",
    amount: 260.0,
    balance: 260.0,
    status: "pending",
  },
  {
    id: "ap2",
    supplierName: "Proveedor ABC",
    description: "Factura #112",
    amount: 180.0,
    balance: 0,
    status: "paid",
  },
]);

const totalReceivable = computed(() =>
  receivables.value.reduce((s, a) => s + a.balance, 0),
);
const totalPayable = computed(() =>
  payables.value
    .filter((a) => a.status === "pending")
    .reduce((s, a) => s + a.balance, 0),
);

function daysSince(d: string): number {
  return Math.floor(
    (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function collectViaWhatsApp(phone: string, name: string, amount: number) {
  window.open(
    generateCollectionWhatsAppUrl(phone, name, amount, "Nova"),
    "_blank",
  );
}

function collectAll() {
  for (const a of receivables.value) {
    if (a.balance > 0 && a.customerPhone)
      collectViaWhatsApp(a.customerPhone, a.customerName, a.balance);
  }
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">Cuentas</h1>
      <div class="text-sm text-gray-500">
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

    <div v-if="activeTab === 'receivable'" class="space-y-3">
      <button
        class="w-full rounded-xl bg-green-600 py-3 text-sm font-medium text-white"
        @click="collectAll"
      >
        Cobrar a todos los pendientes
      </button>
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
                >{{ daysSince(a.createdAt) }}d</span
              >
              <p class="font-medium text-gray-900">{{ a.customerName }}</p>
            </div>
            <p class="mt-0.5 text-xs text-gray-500">
              Debe ${{ a.balance.toFixed(2) }} de ${{ a.amount.toFixed(2) }}
            </p>
          </div>
          <button
            class="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700"
            @click="
              collectViaWhatsApp(a.customerPhone, a.customerName, a.balance)
            "
          >
            WhatsApp
          </button>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'payable'" class="space-y-3">
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
              ${{ a.balance.toFixed(2) }}
            </p>
            <span
              class="text-xs"
              :class="
                a.status === 'paid' ? 'text-green-600' : 'text-orange-600'
              "
              >{{ a.status === "paid" ? "Pagado" : "Pendiente" }}</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
