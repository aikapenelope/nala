<script setup lang="ts">
/**
 * Customer list page with search and segment badges.
 *
 * Connected to: GET /api/customers?search=&page=&limit=
 */

import type { CustomerSegment } from "@nova/shared";

const { isDesktop } = useDevice();
const { $api } = useApi();

const searchQuery = ref("");
const isLoading = ref(true);
const loadError = ref("");

const segmentConfig: Record<CustomerSegment, { label: string; color: string }> =
  {
    vip: { label: "VIP", color: "bg-purple-100 text-purple-700" },
    frequent: { label: "Frecuente", color: "bg-blue-100 text-blue-700" },
    at_risk: { label: "En riesgo", color: "bg-orange-100 text-orange-700" },
    new: { label: "Nuevo", color: "bg-green-100 text-green-700" },
    with_debt: { label: "Con deuda", color: "bg-red-100 text-red-700" },
    inactive: { label: "Inactivo", color: "bg-gray-100 text-gray-500" },
  };

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  totalPurchases: number;
  averageTicketUsd: string;
  balanceUsd: string;
}

const customersList = ref<Customer[]>([]);
const totalCustomers = ref(0);

let searchTimer: ReturnType<typeof setTimeout> | null = null;

async function fetchCustomers() {
  isLoading.value = true;
  loadError.value = "";

  try {
    const params = new URLSearchParams();
    if (searchQuery.value) params.set("search", searchQuery.value);
    params.set("limit", "100");

    const result = await $api<{
      customers: Customer[];
      total: number;
    }>(`/api/customers?${params.toString()}`);

    customersList.value = result.customers;
    totalCustomers.value = result.total;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando clientes";
    loadError.value = message;
  } finally {
    isLoading.value = false;
  }
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => fetchCustomers(), 300);
}

onMounted(() => {
  fetchCustomers();
});

/** Derive simple segments from customer data for badge display. */
function getSegments(c: Customer): CustomerSegment[] {
  const segments: CustomerSegment[] = [];
  if (Number(c.balanceUsd) > 0) segments.push("with_debt");
  if (c.totalPurchases >= 20) segments.push("frequent");
  return segments;
}

/** Edit customer modal. */
const showEditModal = ref(false);
const editId = ref("");
const editForm = reactive({ name: "", phone: "" });
const editSubmitting = ref(false);
const editError = ref("");

function openEdit(c: Customer) {
  editId.value = c.id;
  editForm.name = c.name;
  editForm.phone = c.phone ?? "";
  editError.value = "";
  showEditModal.value = true;
}

async function submitEdit() {
  if (!editForm.name.trim()) {
    editError.value = "Nombre es obligatorio";
    return;
  }
  editSubmitting.value = true;
  editError.value = "";
  try {
    await $api(`/api/customers/${editId.value}`, {
      method: "PATCH",
      body: {
        name: editForm.name.trim(),
        phone: editForm.phone || undefined,
      },
    });
    showEditModal.value = false;
    await fetchCustomers();
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    editError.value = fetchError.data?.error ?? "Error al guardar";
  } finally {
    editSubmitting.value = false;
  }
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">Clientes</h1>
      <NuxtLink
        to="/clients/new"
        class="rounded-lg bg-nova-primary px-4 py-2 text-sm font-medium text-white"
      >
        + Cliente
      </NuxtLink>
    </div>

    <div class="mb-4 flex gap-3">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Buscar cliente..."
        class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
        @input="onSearchInput"
      >
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando clientes...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
      <button
        class="mt-2 block w-full text-xs font-medium text-red-700 underline"
        @click="fetchCustomers"
      >
        Reintentar
      </button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="customersList.length === 0"
      class="py-12 text-center text-gray-400"
    >
      {{ searchQuery ? "Sin resultados" : "No hay clientes registrados" }}
    </div>

    <template v-else>
      <!-- Desktop table -->
      <div
        v-if="isDesktop"
        class="overflow-hidden rounded-xl bg-white shadow-sm"
      >
        <table class="w-full text-left text-sm">
          <thead class="border-b border-gray-200 bg-gray-50">
            <tr>
              <th class="px-4 py-3 font-medium text-gray-500">Cliente</th>
              <th class="px-4 py-3 font-medium text-gray-500">Telefono</th>
              <th class="px-4 py-3 text-right font-medium text-gray-500">
                Compras
              </th>
              <th class="px-4 py-3 text-right font-medium text-gray-500">
                Ticket prom.
              </th>
              <th class="px-4 py-3 text-right font-medium text-gray-500">
                Saldo
              </th>
              <th class="px-4 py-3 font-medium text-gray-500">Segmentos</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="c in customersList"
              :key="c.id"
              class="cursor-pointer hover:bg-gray-50"
            >
              <td class="px-4 py-3 font-medium text-gray-900">{{ c.name }}</td>
              <td class="px-4 py-3 text-gray-500">{{ c.phone ?? "-" }}</td>
              <td class="px-4 py-3 text-right text-gray-700">
                {{ c.totalPurchases }}
              </td>
              <td class="px-4 py-3 text-right text-gray-700">
                ${{ Number(c.averageTicketUsd).toFixed(2) }}
              </td>
              <td
                class="px-4 py-3 text-right font-medium"
                :class="
                  Number(c.balanceUsd) > 0 ? 'text-red-600' : 'text-gray-500'
                "
              >
                {{
                  Number(c.balanceUsd) > 0
                    ? `$${Number(c.balanceUsd).toFixed(2)}`
                    : "-"
                }}
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="seg in getSegments(c)"
                    :key="seg"
                    class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    :class="segmentConfig[seg].color"
                  >
                    {{ segmentConfig[seg].label }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-2">
                  <NuxtLink
                    :to="`/clients/${c.id}`"
                    class="text-xs text-nova-primary hover:underline"
                  >
                    Stats
                  </NuxtLink>
                  <button
                    class="text-xs text-gray-500 hover:text-gray-700"
                    @click="openEdit(c)"
                  >
                    Editar
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div v-else class="space-y-2">
        <div
          v-for="c in customersList"
          :key="c.id"
          class="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm"
        >
          <div
            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-nova-primary text-sm font-bold text-white"
          >
            {{ c.name.charAt(0) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="truncate font-medium text-gray-900">{{ c.name }}</p>
              <span
                v-for="seg in getSegments(c).slice(0, 2)"
                :key="seg"
                class="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                :class="segmentConfig[seg].color"
              >
                {{ segmentConfig[seg].label }}
              </span>
            </div>
            <p class="text-xs text-gray-500">{{ c.totalPurchases }} compras</p>
          </div>
          <div
            v-if="Number(c.balanceUsd) > 0"
            class="text-sm font-medium text-red-600"
          >
            ${{ Number(c.balanceUsd).toFixed(2) }}
          </div>
          <div class="flex flex-col items-end gap-1">
            <NuxtLink
              :to="`/clients/${c.id}`"
              class="text-[10px] text-nova-primary"
            >
              Stats
            </NuxtLink>
            <button
              class="text-[10px] text-gray-400"
              @click="openEdit(c)"
            >
              Editar
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Edit customer modal -->
    <Teleport to="body">
      <div
        v-if="showEditModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showEditModal = false"
      >
        <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="mb-4 text-lg font-semibold text-gray-900">
            Editar cliente
          </h3>
          <div class="space-y-3">
            <div>
              <label class="mb-1 block text-sm text-gray-600">Nombre *</label>
              <input
                v-model="editForm.name"
                type="text"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
                autofocus
              >
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600">Telefono</label>
              <input
                v-model="editForm.phone"
                type="tel"
                placeholder="+58 412 1234567"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              >
            </div>
          </div>
          <p v-if="editError" class="mt-2 text-sm text-red-500">
            {{ editError }}
          </p>
          <div class="mt-4 flex gap-3">
            <button
              class="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
              @click="showEditModal = false"
            >
              Cancelar
            </button>
            <button
              class="flex-1 rounded-lg bg-nova-primary py-2 text-sm font-medium text-white disabled:opacity-50"
              :disabled="editSubmitting"
              @click="submitEdit"
            >
              {{ editSubmitting ? "Guardando..." : "Guardar" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
