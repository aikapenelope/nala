<script setup lang="ts">
/**
 * Bank accounts settings page.
 *
 * Connected to:
 * - GET /api/bank-accounts
 * - POST /api/bank-accounts
 * - PATCH /api/bank-accounts/:id
 */

import { ArrowLeft } from "lucide-vue-next";

definePageMeta({ middleware: ["admin-only"] });

const { $api } = useApi();

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string | null;
  accountHolder: string | null;
  accountType: string | null;
}

const items = ref<BankAccount[]>([]);
const isLoading = ref(true);

/** New bank account form. */
const showForm = ref(false);
const form = reactive({
  bankName: "",
  accountNumber: "",
  accountHolder: "",
  accountType: "corriente",
});
const isCreating = ref(false);
const createError = ref("");

async function fetchItems() {
  isLoading.value = true;
  try {
    const result = await $api<{ bankAccounts: BankAccount[] }>(
      "/api/bank-accounts",
    );
    items.value = result.bankAccounts;
  } catch {
    // Non-critical
  } finally {
    isLoading.value = false;
  }
}

async function createItem() {
  if (!form.bankName.trim()) return;
  isCreating.value = true;
  createError.value = "";
  try {
    await $api("/api/bank-accounts", {
      method: "POST",
      body: {
        bankName: form.bankName.trim(),
        accountNumber: form.accountNumber || undefined,
        accountHolder: form.accountHolder || undefined,
        accountType: form.accountType,
      },
    });
    form.bankName = "";
    form.accountNumber = "";
    form.accountHolder = "";
    showForm.value = false;
    await fetchItems();
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    createError.value = fetchError.data?.error ?? "Error al crear";
  } finally {
    isCreating.value = false;
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
      <h1 class="text-xl font-bold text-gray-900">Cuentas bancarias</h1>
      <p class="text-sm text-gray-500">
        Bancos registrados para referencia de pagos
      </p>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
    </div>

    <template v-else>
      <!-- Toggle form -->
      <button
        class="mb-4 rounded-lg bg-nova-primary px-4 py-2 text-sm font-medium text-white"
        @click="showForm = !showForm"
      >
        {{ showForm ? "Cancelar" : "+ Agregar cuenta" }}
      </button>

      <!-- Create form -->
      <div
        v-if="showForm"
        class="mb-6 space-y-3 rounded-xl bg-white p-5 shadow-sm"
      >
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs text-gray-500">Banco *</label>
            <input
              v-model="form.bankName"
              type="text"
              placeholder="Ej: Banesco"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            >
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">Tipo</label>
            <select
              v-model="form.accountType"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            >
              <option value="corriente">Corriente</option>
              <option value="ahorro">Ahorro</option>
            </select>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">
            Numero de cuenta
          </label>
          <input
            v-model="form.accountNumber"
            type="text"
            placeholder="0134-0000-00-0000000000"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
          >
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">Titular</label>
          <input
            v-model="form.accountHolder"
            type="text"
            placeholder="Nombre del titular"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
          >
        </div>
        <p v-if="createError" class="text-xs text-red-500">
          {{ createError }}
        </p>
        <button
          class="w-full rounded-lg bg-nova-primary py-2 text-sm font-medium text-white disabled:opacity-50"
          :disabled="isCreating || !form.bankName.trim()"
          @click="createItem"
        >
          {{ isCreating ? "Guardando..." : "Guardar cuenta" }}
        </button>
      </div>

      <!-- List -->
      <div v-if="items.length > 0" class="space-y-2">
        <div
          v-for="item in items"
          :key="item.id"
          class="rounded-xl bg-white px-5 py-4 shadow-sm"
        >
          <p class="text-sm font-medium text-gray-900">{{ item.bankName }}</p>
          <p v-if="item.accountNumber" class="text-xs text-gray-500">
            {{ item.accountNumber }}
            <span v-if="item.accountType" class="text-gray-400">
              · {{ item.accountType }}
            </span>
          </p>
          <p v-if="item.accountHolder" class="text-xs text-gray-400">
            {{ item.accountHolder }}
          </p>
        </div>
      </div>
      <p v-else-if="!showForm" class="text-center text-sm text-gray-400">
        No hay cuentas bancarias registradas
      </p>
    </template>
  </div>
</template>
