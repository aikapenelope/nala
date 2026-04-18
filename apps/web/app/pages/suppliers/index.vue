<script setup lang="ts">
/**
 * Suppliers list page.
 *
 * Connected to:
 * - GET /api/suppliers
 */

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
    <h1 class="mb-4 text-xl font-bold text-gray-900">Proveedores</h1>

    <!-- Search -->
    <input
      v-model="search"
      type="text"
      placeholder="Buscar proveedor..."
      class="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
    >

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando proveedores...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
    </div>

    <!-- Empty -->
    <div
      v-else-if="suppliers.length === 0"
      class="py-12 text-center text-gray-400"
    >
      {{ search ? "Sin resultados" : "No hay proveedores registrados" }}
    </div>

    <!-- List -->
    <div v-else class="space-y-2">
      <NuxtLink
        v-for="s in suppliers"
        :key="s.id"
        :to="`/suppliers/${s.id}`"
        class="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
      >
        <div>
          <p class="text-sm font-medium text-gray-900">{{ s.name }}</p>
          <p v-if="s.phone || s.email" class="text-xs text-gray-500">
            {{ s.phone ?? s.email }}
          </p>
        </div>
        <span class="text-xs text-nova-primary">Ver cuenta</span>
      </NuxtLink>
    </div>
  </div>
</template>
