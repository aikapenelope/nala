<script setup lang="ts">
/**
 * Suppliers list page with inline create form.
 *
 * Connected to:
 * - GET /api/suppliers
 * - POST /api/suppliers
 */

import { Search, Truck, Plus, X } from "lucide-vue-next";

const { $api } = useApi();
const { toast } = useToast();

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

onMounted(() => {
  fetchSuppliers();
});

watch(search, () => {
  fetchSuppliers();
});

// ============================================================
// Create supplier form
// ============================================================

const showCreateForm = ref(false);
const isSaving = ref(false);

const newSupplier = reactive({
  name: "",
  rif: "",
  phone: "",
  email: "",
});

function resetForm() {
  newSupplier.name = "";
  newSupplier.rif = "";
  newSupplier.phone = "";
  newSupplier.email = "";
}

function openCreateForm() {
  resetForm();
  showCreateForm.value = true;
}

function closeCreateForm() {
  showCreateForm.value = false;
  resetForm();
}

async function createSupplier() {
  const name = newSupplier.name.trim();
  if (!name) return;

  isSaving.value = true;
  try {
    const body: Record<string, string> = { name };
    if (newSupplier.rif.trim()) body.rif = newSupplier.rif.trim();
    if (newSupplier.phone.trim()) body.phone = newSupplier.phone.trim();
    if (newSupplier.email.trim()) body.email = newSupplier.email.trim();

    await $api("/api/suppliers", {
      method: "POST",
      body,
    });

    toast("Proveedor creado", "success");
    closeCreateForm();
    await fetchSuppliers();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error creando proveedor";
    toast(message, "error");
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <!-- Header with title and add button -->
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-extrabold tracking-tight text-gradient">Proveedores</h1>
      <button
        class="dark-pill flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-bold transition-spring"
        @click="openCreateForm"
      >
        <Plus :size="14" />
        Agregar
      </button>
    </div>

    <!-- Create form (inline, collapsible) -->
    <div
      v-if="showCreateForm"
      class="card-premium mb-4 p-4"
    >
      <div class="mb-3 flex items-center justify-between">
        <p class="text-sm font-bold text-gray-800">Nuevo proveedor</p>
        <button
          class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          @click="closeCreateForm"
        >
          <X :size="16" />
        </button>
      </div>

      <form class="space-y-3" @submit.prevent="createSupplier">
        <!-- Name (required) -->
        <div>
          <label class="mb-1 block text-xs font-semibold text-gray-500">Nombre *</label>
          <input
            v-model="newSupplier.name"
            type="text"
            placeholder="Ej: Distribuidora Central"
            class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 outline-none transition-colors focus:border-nova-primary focus:ring-1 focus:ring-nova-primary/30"
            required
            maxlength="200"
          >
        </div>

        <!-- RIF + Phone (side by side) -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-gray-500">RIF</label>
            <input
              v-model="newSupplier.rif"
              type="text"
              placeholder="J-12345678-9"
              class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 outline-none transition-colors focus:border-nova-primary focus:ring-1 focus:ring-nova-primary/30"
              maxlength="20"
            >
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-gray-500">Telefono</label>
            <input
              v-model="newSupplier.phone"
              type="tel"
              placeholder="0412-1234567"
              class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 outline-none transition-colors focus:border-nova-primary focus:ring-1 focus:ring-nova-primary/30"
              maxlength="20"
            >
          </div>
        </div>

        <!-- Email -->
        <div>
          <label class="mb-1 block text-xs font-semibold text-gray-500">Email</label>
          <input
            v-model="newSupplier.email"
            type="email"
            placeholder="proveedor@email.com"
            class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 outline-none transition-colors focus:border-nova-primary focus:ring-1 focus:ring-nova-primary/30"
          >
        </div>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="!newSupplier.name.trim() || isSaving"
          class="w-full rounded-2xl bg-nova-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-nova-primary/90 disabled:opacity-50"
        >
          {{ isSaving ? "Guardando..." : "Guardar proveedor" }}
        </button>
      </form>
    </div>

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
      <Truck :size="32" class="mx-auto mb-3 text-gray-300" />
      <p class="text-sm font-medium text-gray-400">
        {{ search ? "Sin resultados" : "No hay proveedores registrados" }}
      </p>
      <button
        v-if="!search && !showCreateForm"
        class="mt-3 text-sm font-bold text-nova-primary"
        @click="openCreateForm"
      >
        Agregar primer proveedor
      </button>
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
