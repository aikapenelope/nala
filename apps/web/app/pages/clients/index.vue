<script setup lang="ts">
/**
 * Customer list page with search and segment badges.
 *
 * Connected to: GET /api/customers?search=&page=&limit=
 */

import type { CustomerSegment } from "@nova/shared";
import { Search, UserPlus } from "lucide-vue-next";

const { isDesktop } = useDevice();
const { $api } = useApi();

const searchQuery = ref("");
const isLoading = ref(true);
const loadError = ref("");

const segmentConfig: Record<CustomerSegment, { label: string; color: string }> =
  {
    vip: { label: "VIP", color: "bg-purple-50 text-purple-700" },
    frequent: { label: "Frecuente", color: "bg-blue-50 text-blue-700" },
    at_risk: { label: "En riesgo", color: "bg-orange-50 text-orange-700" },
    new: { label: "Nuevo", color: "bg-green-50 text-green-700" },
    with_debt: { label: "Con deuda", color: "bg-red-50 text-red-700" },
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
    <SharedContextualTip
      tip-id="clients"
      title="Tus clientes"
      description="Nova crea perfiles automaticos de tus clientes a partir de sus compras. Puedes ver historial, saldo pendiente (fiado), y segmentos (VIP, en riesgo). Toca un cliente para ver su detalle."
    />

    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-extrabold tracking-tight text-gradient">Clientes</h1>
      <NuxtLink
        to="/clients/new"
        class="dark-pill flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-bold transition-spring"
      >
        <UserPlus :size="14" />
        Cliente
      </NuxtLink>
    </div>

    <div class="mb-4">
      <div class="glass relative flex items-center rounded-2xl px-4 py-2.5">
        <Search :size="16" class="mr-2 flex-shrink-0 text-gray-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar cliente..."
          class="w-full bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
          @input="onSearchInput"
        >
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary" />
      Cargando clientes...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="card-premium p-6 text-center"
    >
      <p class="text-sm font-semibold text-red-500">{{ loadError }}</p>
      <button
        class="mt-3 text-xs font-bold text-nova-primary underline"
        @click="fetchCustomers"
      >
        Reintentar
      </button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="customersList.length === 0"
      class="card-premium py-12 text-center"
    >
      <p class="text-sm font-medium text-gray-400">
        {{ searchQuery ? "Sin resultados" : "No hay clientes registrados" }}
      </p>
    </div>

    <template v-else>
      <!-- Desktop table -->
      <div
        v-if="isDesktop"
        class="card-premium overflow-hidden"
      >
        <table class="w-full text-left text-sm">
          <thead class="border-b border-white/50">
            <tr>
              <th class="px-4 py-3.5 text-[11px] font-bold tracking-wider text-gray-400 uppercase">Cliente</th>
              <th class="px-4 py-3.5 text-[11px] font-bold tracking-wider text-gray-400 uppercase">Telefono</th>
              <th class="px-4 py-3.5 text-right text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                Compras
              </th>
              <th class="px-4 py-3.5 text-right text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                Ticket prom.
              </th>
              <th class="px-4 py-3.5 text-right text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                Saldo
              </th>
              <th class="px-4 py-3.5 text-[11px] font-bold tracking-wider text-gray-400 uppercase">Segmentos</th>
              <th class="px-4 py-3.5" />
            </tr>
          </thead>
          <tbody class="divide-y divide-white/30">
            <tr
              v-for="c in customersList"
              :key="c.id"
              class="cursor-pointer transition-spring hover:bg-white/60"
            >
              <td class="px-4 py-3.5">
                <div class="flex items-center gap-2.5">
                  <div
                    class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#EFECFF] to-[#D0CCF9] text-xs font-extrabold text-nova-accent"
                  >
                    {{ c.name.charAt(0) }}
                  </div>
                  <span class="font-semibold text-gray-800">{{ c.name }}</span>
                </div>
              </td>
              <td class="px-4 py-3.5 text-gray-500">{{ c.phone ?? "-" }}</td>
              <td class="px-4 py-3.5 text-right font-semibold text-gray-700">
                {{ c.totalPurchases }}
              </td>
              <td class="px-4 py-3.5 text-right font-semibold text-gray-700">
                ${{ Number(c.averageTicketUsd).toFixed(2) }}
              </td>
              <td
                class="px-4 py-3.5 text-right font-bold"
                :class="
                  Number(c.balanceUsd) > 0 ? 'text-red-600' : 'text-gray-400'
                "
              >
                {{
                  Number(c.balanceUsd) > 0
                    ? `$${Number(c.balanceUsd).toFixed(2)}`
                    : "-"
                }}
              </td>
              <td class="px-4 py-3.5">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="seg in getSegments(c)"
                    :key="seg"
                    class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    :class="segmentConfig[seg].color"
                  >
                    {{ segmentConfig[seg].label }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3.5">
                <div class="flex gap-2">
                  <NuxtLink
                    :to="`/clients/${c.id}`"
                    class="rounded-xl bg-nova-primary/10 px-2.5 py-1 text-[11px] font-bold text-nova-primary transition-spring hover:bg-nova-primary/20"
                  >
                    Stats
                  </NuxtLink>
                  <button
                    class="rounded-xl bg-gray-100/80 px-2.5 py-1 text-[11px] font-bold text-gray-500 transition-spring hover:bg-gray-200"
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
      <div v-else class="space-y-2.5">
        <div
          v-for="c in customersList"
          :key="c.id"
          class="card-premium card-lift flex items-center gap-3 p-4"
        >
          <div
            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#EFECFF] to-[#D0CCF9] text-sm font-extrabold text-nova-accent"
          >
            {{ c.name.charAt(0) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="truncate font-semibold text-gray-800">{{ c.name }}</p>
              <span
                v-for="seg in getSegments(c).slice(0, 2)"
                :key="seg"
                class="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                :class="segmentConfig[seg].color"
              >
                {{ segmentConfig[seg].label }}
              </span>
            </div>
            <p class="text-xs font-medium text-gray-500">{{ c.totalPurchases }} compras</p>
          </div>
          <div
            v-if="Number(c.balanceUsd) > 0"
            class="rounded-lg bg-red-50 px-2 py-0.5 text-sm font-bold text-red-600"
          >
            ${{ Number(c.balanceUsd).toFixed(2) }}
          </div>
          <div class="flex flex-col items-end gap-1">
            <NuxtLink
              :to="`/clients/${c.id}`"
              class="rounded-lg bg-nova-primary/10 px-2 py-0.5 text-[10px] font-bold text-nova-primary"
            >
              Stats
            </NuxtLink>
            <button
              class="text-[10px] font-bold text-gray-400 transition-spring hover:text-gray-600"
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
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showEditModal = false"
      >
        <div class="glass-strong w-full max-w-sm rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
          <h3 class="mb-5 text-xl font-extrabold tracking-tight text-gradient">
            Editar cliente
          </h3>
          <div class="space-y-4">
            <div>
              <label class="mb-1.5 block text-[13px] font-bold text-gray-600">Nombre *</label>
              <input
                v-model="editForm.name"
                type="text"
                class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
                autofocus
              >
            </div>
            <div>
              <label class="mb-1.5 block text-[13px] font-bold text-gray-600">Telefono</label>
              <input
                v-model="editForm.phone"
                type="tel"
                placeholder="+58 412 1234567"
                class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
              >
            </div>
          </div>
          <p v-if="editError" class="mt-3 text-sm font-semibold text-red-500">
            {{ editError }}
          </p>
          <div class="mt-5 flex gap-3">
            <button
              class="glass flex-1 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
              @click="showEditModal = false"
            >
              Cancelar
            </button>
            <button
              class="dark-pill flex-1 rounded-2xl py-3 text-sm font-bold transition-spring disabled:opacity-50"
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
