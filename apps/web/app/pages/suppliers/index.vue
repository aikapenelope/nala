<script setup lang="ts">
/**
 * Suppliers list page.
 *
 * Connected to:
 * - GET /api/suppliers
 */

import { Search, Truck } from "lucide-vue-next";

definePageMeta({ middleware: ["admin-only"] });

const { $api } = useApi();

const isLoading = ref(true);
const loadError = ref("");
const search = ref("");

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

const suppliers = ref<Supplier[]>([]);

async function fetchSuppliers() {
  isLoading.value = true;
  loadError.value = "";
  try {
    const params = search.value ? `?search=${encodeURIComponent(search.value)}` : "";
    const result = await $api<{ suppliers: Supplier[] }>(
      `/api/suppliers${params}`,
    );
    suppliers.value = result.suppliers;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error cargando proveedores";
    loadError.value = message;
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchSuppliers);

watch(search, () => {
  fetchSuppliers();
});
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="mb-4 text-2xl font-extrabold tracking-tight text-gradient">Proveedores</h1>

    <!-- Search -->
    <div class="glass mb-4 flex items-center rounded-2xl px-4 py-2.5">
      <Search :size="16" class="mr-2 flex-shrink-0 text-gray-400" />
      <input
        v-model="search"
        type="text"
        placeholder="Buscar proveedor..."
        class="w-full bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
      >
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary" />
      Cargando proveedores...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="card-premium p-6 text-center"
    >
      <p class="text-sm font-semibold text-red-500">{{ loadError }}</p>
    </div>

    <!-- Empty -->
    <div
      v-else-if="suppliers.length === 0"
      class="card-premium py-12 text-center"
    >
      <p class="text-sm font-medium text-gray-400">
        {{ search ? "Sin resultados" : "No hay proveedores registrados" }}
      </p>
    </div>

    <!-- List -->
    <div v-else class="space-y-2.5">
      <NuxtLink
        v-for="s in suppliers"
        :key="s.id"
        :to="`/suppliers/${s.id}`"
        class="card-premium card-lift flex items-center gap-4 p-4"
      >
        <div class="dark-pill flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px]">
          <Truck :size="16" class="text-white" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold text-gray-800">{{ s.name }}</p>
          <p v-if="s.phone || s.email" class="text-xs font-medium text-gray-500">
            {{ s.phone ?? s.email }}
          </p>
        </div>
        <span class="rounded-xl bg-nova-primary/10 px-2.5 py-1 text-[11px] font-bold text-nova-primary">
          Ver cuenta
        </span>
      </NuxtLink>
    </div>
  </div>
</template>
