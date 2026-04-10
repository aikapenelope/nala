<script setup lang="ts">
/**
 * Customer list page with search, segment filter, and badges.
 */

import type { CustomerSegment } from "@nova/shared";

const { isDesktop } = useDevice();
const searchQuery = ref("");
const segmentFilter = ref<CustomerSegment | null>(null);

const segmentConfig: Record<CustomerSegment, { label: string; color: string }> =
  {
    vip: { label: "VIP", color: "bg-purple-100 text-purple-700" },
    frequent: { label: "Frecuente", color: "bg-blue-100 text-blue-700" },
    at_risk: { label: "En riesgo", color: "bg-orange-100 text-orange-700" },
    new: { label: "Nuevo", color: "bg-green-100 text-green-700" },
    with_debt: { label: "Con deuda", color: "bg-red-100 text-red-700" },
    inactive: { label: "Inactivo", color: "bg-gray-100 text-gray-500" },
  };

const customers = ref([
  {
    id: "c1",
    name: "Juan Pérez",
    phone: "+58412-555-0010",
    totalPurchases: 45,
    averageTicket: 18.5,
    balance: 65.0,
    segments: ["frequent", "with_debt"] as CustomerSegment[],
  },
  {
    id: "c2",
    name: "María García",
    phone: "+58414-555-0020",
    totalPurchases: 120,
    averageTicket: 32.0,
    balance: 0,
    segments: ["vip", "frequent"] as CustomerSegment[],
  },
  {
    id: "c3",
    name: "Pedro López",
    phone: "+58424-555-0030",
    totalPurchases: 8,
    averageTicket: 12.0,
    balance: 100.0,
    segments: ["at_risk", "with_debt"] as CustomerSegment[],
  },
  {
    id: "c4",
    name: "Ana Rodríguez",
    phone: null,
    totalPurchases: 2,
    averageTicket: 15.0,
    balance: 0,
    segments: ["new"] as CustomerSegment[],
  },
]);

const filteredCustomers = computed(() => {
  return customers.value.filter((c) => {
    if (
      searchQuery.value &&
      !c.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
      return false;
    if (segmentFilter.value && !c.segments.includes(segmentFilter.value))
      return false;
    return true;
  });
});
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">Clientes</h1>
      <NuxtLink
        to="/clients/new"
        class="rounded-lg bg-nova-primary px-4 py-2 text-sm font-medium text-white"
        >+ Cliente</NuxtLink
      >
    </div>

    <div class="mb-4 flex gap-3">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Buscar cliente..."
        class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
      />
      <select
        v-model="segmentFilter"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option :value="null">Todos</option>
        <option value="vip">VIP</option>
        <option value="frequent">Frecuentes</option>
        <option value="at_risk">En riesgo</option>
        <option value="with_debt">Con deuda</option>
      </select>
    </div>

    <!-- Desktop table -->
    <div v-if="isDesktop" class="overflow-hidden rounded-xl bg-white shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-gray-200 bg-gray-50">
          <tr>
            <th class="px-4 py-3 font-medium text-gray-500">Cliente</th>
            <th class="px-4 py-3 font-medium text-gray-500">Teléfono</th>
            <th class="px-4 py-3 font-medium text-gray-500 text-right">
              Compras
            </th>
            <th class="px-4 py-3 font-medium text-gray-500 text-right">
              Ticket prom.
            </th>
            <th class="px-4 py-3 font-medium text-gray-500 text-right">
              Saldo
            </th>
            <th class="px-4 py-3 font-medium text-gray-500">Segmentos</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="c in filteredCustomers"
            :key="c.id"
            class="cursor-pointer hover:bg-gray-50"
          >
            <td class="px-4 py-3 font-medium text-gray-900">{{ c.name }}</td>
            <td class="px-4 py-3 text-gray-500">{{ c.phone ?? "-" }}</td>
            <td class="px-4 py-3 text-right text-gray-700">
              {{ c.totalPurchases }}
            </td>
            <td class="px-4 py-3 text-right text-gray-700">
              ${{ c.averageTicket.toFixed(2) }}
            </td>
            <td
              class="px-4 py-3 text-right font-medium"
              :class="c.balance > 0 ? 'text-red-600' : 'text-gray-500'"
            >
              {{ c.balance > 0 ? `$${c.balance.toFixed(2)}` : "-" }}
            </td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="seg in c.segments"
                  :key="seg"
                  class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  :class="segmentConfig[seg].color"
                  >{{ segmentConfig[seg].label }}</span
                >
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile cards -->
    <div v-else class="space-y-2">
      <div
        v-for="c in filteredCustomers"
        :key="c.id"
        class="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm"
      >
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-nova-primary text-sm font-bold text-white"
        >
          {{ c.name.charAt(0) }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="truncate font-medium text-gray-900">{{ c.name }}</p>
            <span
              v-for="seg in c.segments.slice(0, 2)"
              :key="seg"
              class="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
              :class="segmentConfig[seg].color"
              >{{ segmentConfig[seg].label }}</span
            >
          </div>
          <p class="text-xs text-gray-500">{{ c.totalPurchases }} compras</p>
        </div>
        <div v-if="c.balance > 0" class="text-sm font-medium text-red-600">
          ${{ c.balance.toFixed(2) }}
        </div>
      </div>
    </div>
  </div>
</template>
