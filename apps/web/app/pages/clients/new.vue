<script setup lang="ts">
/**
 * Create new customer page.
 *
 * Simple form: name (required), phone, email, address, notes.
 * Connected to: POST /api/customers
 */

const router = useRouter();
const { $api } = useApi();

const name = ref("");
const phone = ref("");
const email = ref("");
const address = ref("");
const notes = ref("");
const isSubmitting = ref(false);
const error = ref("");

const canSubmit = computed(
  () => name.value.trim().length > 0 && !isSubmitting.value,
);

async function createCustomer() {
  if (!canSubmit.value) return;

  isSubmitting.value = true;
  error.value = "";

  try {
    await $api("/api/customers", {
      method: "POST",
      body: {
        name: name.value.trim(),
        phone: phone.value.trim() || undefined,
        email: email.value.trim() || undefined,
        address: address.value.trim() || undefined,
        notes: notes.value.trim() || undefined,
      },
    });

    router.push("/clients");
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    error.value =
      fetchError.data?.error ?? "Error al crear el cliente. Intenta de nuevo.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg">
    <div class="mb-6 flex items-center gap-3">
      <NuxtLink to="/clients" class="text-gray-400 hover:text-gray-600">
        ←
      </NuxtLink>
      <h1 class="text-xl font-bold text-gray-900">Nuevo cliente</h1>
    </div>

    <div class="space-y-4 rounded-xl bg-white p-5 shadow-sm">
      <div>
        <label class="mb-1 block text-sm text-gray-600">Nombre *</label>
        <input
          v-model="name"
          type="text"
          placeholder="Ej: Juan Perez"
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none focus:ring-2 focus:ring-nova-primary/20"
          autofocus
        />
      </div>

      <div>
        <label class="mb-1 block text-sm text-gray-600">Telefono</label>
        <input
          v-model="phone"
          type="tel"
          placeholder="Ej: 0412-1234567"
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none focus:ring-2 focus:ring-nova-primary/20"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm text-gray-600">Email</label>
        <input
          v-model="email"
          type="email"
          placeholder="Ej: juan@email.com"
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none focus:ring-2 focus:ring-nova-primary/20"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm text-gray-600">Direccion</label>
        <input
          v-model="address"
          type="text"
          placeholder="Ej: Av. Principal, Local 5"
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none focus:ring-2 focus:ring-nova-primary/20"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm text-gray-600">Notas</label>
        <textarea
          v-model="notes"
          rows="2"
          placeholder="Notas internas sobre este cliente"
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none focus:ring-2 focus:ring-nova-primary/20"
        />
      </div>

      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

      <div class="flex gap-3 pt-2">
        <NuxtLink
          to="/clients"
          class="flex-1 rounded-lg border border-gray-300 py-2.5 text-center text-sm font-medium text-gray-700"
        >
          Cancelar
        </NuxtLink>
        <button
          class="flex-1 rounded-lg bg-nova-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
          :disabled="!canSubmit"
          @click="createCustomer"
        >
          {{ isSubmitting ? "Guardando..." : "Guardar cliente" }}
        </button>
      </div>
    </div>
  </div>
</template>
