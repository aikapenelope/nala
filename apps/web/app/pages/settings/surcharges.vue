<script setup lang="ts">
/**
 * Surcharge types CRUD settings page.
 *
 * Connected to:
 * - GET /api/surcharge-types
 * - POST /api/surcharge-types
 * - PATCH /api/surcharge-types/:id
 * - DELETE /api/surcharge-types/:id
 */

import { ArrowLeft } from "lucide-vue-next";

definePageMeta({ middleware: ["admin-only"] });

const { $api } = useApi();

interface SurchargeType {
  id: string;
  name: string;
  defaultAmount: string | null;
  isActive: boolean;
}

const items = ref<SurchargeType[]>([]);
const isLoading = ref(true);
const loadError = ref("");

/** New surcharge form. */
const newName = ref("");
const newAmount = ref(0);
const isCreating = ref(false);
const createError = ref("");

async function fetchItems() {
  isLoading.value = true;
  try {
    const result = await $api<{ surchargeTypes: SurchargeType[] }>(
      "/api/surcharge-types",
    );
    items.value = result.surchargeTypes;
  } catch {
    loadError.value = "Error cargando cargos adicionales";
  } finally {
    isLoading.value = false;
  }
}

async function createItem() {
  if (!newName.value.trim()) return;
  isCreating.value = true;
  createError.value = "";
  try {
    await $api("/api/surcharge-types", {
      method: "POST",
      body: {
        name: newName.value.trim(),
        defaultAmount: newAmount.value > 0 ? newAmount.value : undefined,
      },
    });
    newName.value = "";
    newAmount.value = 0;
    await fetchItems();
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    createError.value = fetchError.data?.error ?? "Error al crear";
  } finally {
    isCreating.value = false;
  }
}

async function deleteItem(id: string) {
  try {
    await $api(`/api/surcharge-types/${id}`, { method: "DELETE" });
    items.value = items.value.filter((i) => i.id !== id);
  } catch {
    // Silent fail
  }
}

onMounted(fetchItems);
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-6">
      <NuxtLink
        to="/settings"
        class="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft :size="16" />
        Configuracion
      </NuxtLink>
      <h1 class="text-xl font-bold text-gray-900">Cargos adicionales</h1>
      <p class="text-sm text-gray-500">
        Delivery, propinas, empaques y otros cargos
      </p>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
    </div>

    <template v-else>
      <!-- Create form -->
      <div class="mb-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 class="mb-3 text-sm font-semibold text-gray-700">Nuevo cargo</h2>
        <div class="flex gap-3">
          <input
            v-model="newName"
            type="text"
            placeholder="Nombre (ej: Delivery)"
            class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
          >
          <input
            v-model.number="newAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Monto"
            class="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
          >
          <button
            class="rounded-lg bg-nova-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            :disabled="isCreating || !newName.trim()"
            @click="createItem"
          >
            {{ isCreating ? "..." : "Agregar" }}
          </button>
        </div>
        <p v-if="createError" class="mt-2 text-xs text-red-500">
          {{ createError }}
        </p>
      </div>

      <!-- List -->
      <div v-if="items.length > 0" class="space-y-2">
        <div
          v-for="item in items"
          :key="item.id"
          class="flex items-center justify-between rounded-xl bg-white px-5 py-3 shadow-sm"
        >
          <div>
            <p class="text-sm font-medium text-gray-900">{{ item.name }}</p>
            <p v-if="item.defaultAmount" class="text-xs text-gray-500">
              Monto por defecto: ${{ Number(item.defaultAmount).toFixed(2) }}
            </p>
          </div>
          <button
            class="text-xs text-red-500 hover:text-red-700"
            @click="deleteItem(item.id)"
          >
            Eliminar
          </button>
        </div>
      </div>
      <p v-else class="text-center text-sm text-gray-400">
        No hay cargos adicionales configurados
      </p>
    </template>
  </div>
</template>
