<script setup lang="ts">
/**
 * Store settings page - configure the online storefront.
 *
 * Allows the owner to:
 * - Enable/disable the online store
 * - Configure payment methods (Pago Movil, Binance, Zinli, etc.)
 * - Set delivery options (toggle, fee, zones)
 * - Set welcome message and minimum order amount
 * - Preview the store link
 *
 * Connected to:
 * - GET  /api/store-settings
 * - PATCH /api/store-settings
 */

import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Store,
  Truck,
  CreditCard,
  Link,
  MessageSquare,
} from "lucide-vue-next";

const { $api } = useApi();
const { user } = useNovaAuth();

interface PaymentMethod {
  method: string;
  label: string;
  details: Record<string, string>;
}

// Form state
const storeEnabled = ref(false);
const paymentMethods = ref<PaymentMethod[]>([]);
const deliveryEnabled = ref(false);
const deliveryFee = ref("0");
const deliveryZones = ref("");
const welcomeMessage = ref("");
const minOrderAmount = ref("0");

// UI state
const isLoading = ref(true);
const loadError = ref("");
const isSaving = ref(false);
const saveSuccess = ref(false);
const saveError = ref("");

// New payment method form
const showAddPayment = ref(false);
const newPaymentMethod = ref("");
const newPaymentLabel = ref("");
const newPaymentDetails = ref<Record<string, string>>({});

/** Available payment method templates. */
const paymentTemplates: Record<string, { label: string; fields: string[] }> = {
  pago_movil: {
    label: "Pago Movil",
    fields: ["banco", "telefono", "cedula"],
  },
  binance: { label: "Binance", fields: ["email", "binance_id"] },
  zinli: { label: "Zinli", fields: ["email", "telefono"] },
  transferencia: { label: "Transferencia", fields: ["banco", "cuenta", "titular", "cedula"] },
  efectivo: { label: "Efectivo", fields: [] },
  zelle: { label: "Zelle", fields: ["email", "nombre"] },
};

/** Store URL for preview. */
const storeUrl = computed(() => {
  const slug = (user.value as { businessSlug?: string } | null)?.businessSlug;
  if (!slug) return null;
  return `https://${slug}.novaincs.com`;
});

/** Fetch current store settings. */
async function fetchSettings() {
  isLoading.value = true;
  loadError.value = "";
  try {
    const result = await $api<{
      settings: {
        storeEnabled: boolean;
        paymentMethods: PaymentMethod[];
        deliveryEnabled: boolean;
        deliveryFee: number;
        deliveryZones: string | null;
        welcomeMessage: string | null;
        minOrderAmount: number;
      };
    }>("/api/store-settings");

    storeEnabled.value = result.settings.storeEnabled;
    paymentMethods.value = result.settings.paymentMethods;
    deliveryEnabled.value = result.settings.deliveryEnabled;
    deliveryFee.value = String(result.settings.deliveryFee);
    deliveryZones.value = result.settings.deliveryZones ?? "";
    welcomeMessage.value = result.settings.welcomeMessage ?? "";
    minOrderAmount.value = String(result.settings.minOrderAmount);
  } catch {
    loadError.value = "Error cargando configuracion de tienda";
  } finally {
    isLoading.value = false;
  }
}

/** Save store settings. */
async function saveSettings() {
  isSaving.value = true;
  saveError.value = "";
  saveSuccess.value = false;

  try {
    await $api("/api/store-settings", {
      method: "PATCH",
      body: {
        storeEnabled: storeEnabled.value,
        paymentMethods: paymentMethods.value,
        deliveryEnabled: deliveryEnabled.value,
        deliveryFee: Number(deliveryFee.value) || 0,
        deliveryZones: deliveryZones.value || null,
        welcomeMessage: welcomeMessage.value || null,
        minOrderAmount: Number(minOrderAmount.value) || 0,
      },
    });

    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 3000);
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    saveError.value =
      fetchError.data?.error ?? "Error al guardar configuracion";
  } finally {
    isSaving.value = false;
  }
}

/** Start adding a new payment method. */
function startAddPayment(method: string) {
  const template = paymentTemplates[method];
  if (!template) return;
  newPaymentMethod.value = method;
  newPaymentLabel.value = template.label;
  newPaymentDetails.value = {};
  for (const field of template.fields) {
    newPaymentDetails.value[field] = "";
  }
  showAddPayment.value = true;
}

/** Confirm adding the new payment method. */
function confirmAddPayment() {
  if (!newPaymentMethod.value || !newPaymentLabel.value) return;
  paymentMethods.value.push({
    method: newPaymentMethod.value,
    label: newPaymentLabel.value,
    details: { ...newPaymentDetails.value },
  });
  showAddPayment.value = false;
  newPaymentMethod.value = "";
  newPaymentLabel.value = "";
  newPaymentDetails.value = {};
}

/** Remove a payment method. */
function removePayment(index: number) {
  paymentMethods.value.splice(index, 1);
}

/** Available methods not yet added. */
const availableMethods = computed(() => {
  const added = new Set(paymentMethods.value.map((pm) => pm.method));
  return Object.entries(paymentTemplates)
    .filter(([key]) => !added.has(key))
    .map(([key, val]) => ({ method: key, label: val.label }));
});

onMounted(fetchSettings);
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <!-- Header -->
    <div class="mb-6">
      <NuxtLink
        to="/settings"
        class="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft :size="16" />
        Configuracion
      </NuxtLink>
      <h1 class="text-xl font-bold text-gray-900">Tienda online</h1>
      <p class="text-sm text-gray-500">
        Configura tu tienda publica para recibir pedidos
      </p>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando configuracion...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
      <button
        class="mt-2 block w-full text-xs font-medium text-red-700 underline"
        @click="fetchSettings"
      >
        Reintentar
      </button>
    </div>

    <!-- Form -->
    <div v-else class="space-y-5">
      <!-- Store toggle -->
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              class="flex h-9 w-9 items-center justify-center rounded-lg"
              :class="storeEnabled ? 'bg-green-50' : 'bg-gray-100'"
            >
              <Store
                :size="18"
                :class="storeEnabled ? 'text-green-600' : 'text-gray-400'"
              />
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900">Tienda activa</p>
              <p class="text-xs text-gray-500">
                {{ storeEnabled ? "Los clientes pueden hacer pedidos" : "Tienda desactivada" }}
              </p>
            </div>
          </div>
          <button
            class="relative h-6 w-11 rounded-full transition-colors"
            :class="storeEnabled ? 'bg-green-500' : 'bg-gray-300'"
            @click="storeEnabled = !storeEnabled"
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
              :class="storeEnabled ? 'left-[22px]' : 'left-0.5'"
            />
          </button>
        </div>

        <!-- Store URL preview -->
        <div
          v-if="storeEnabled && storeUrl"
          class="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"
        >
          <Link :size="14" class="text-gray-400" />
          <a
            :href="storeUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs font-medium text-blue-600 hover:underline"
          >
            {{ storeUrl }}
          </a>
        </div>
      </div>

      <!-- Payment methods -->
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
            <CreditCard :size="18" class="text-purple-600" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-900">Metodos de pago</p>
            <p class="text-xs text-gray-500">
              Datos que ve el cliente al pagar
            </p>
          </div>
        </div>

        <!-- Existing methods -->
        <div v-if="paymentMethods.length > 0" class="space-y-2">
          <div
            v-for="(pm, idx) in paymentMethods"
            :key="idx"
            class="flex items-start justify-between rounded-lg border border-gray-100 p-3"
          >
            <div>
              <p class="text-sm font-semibold text-gray-800">{{ pm.label }}</p>
              <div class="mt-1 space-y-0.5">
                <p
                  v-for="(value, key) in pm.details"
                  :key="key"
                  class="text-xs text-gray-500"
                >
                  <span class="capitalize text-gray-600">{{ key }}:</span>
                  {{ value }}
                </p>
              </div>
            </div>
            <button
              class="text-gray-400 hover:text-red-500"
              @click="removePayment(idx)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>

        <p
          v-else
          class="py-4 text-center text-xs text-gray-400"
        >
          Sin metodos de pago configurados
        </p>

        <!-- Add payment method -->
        <div v-if="!showAddPayment && availableMethods.length > 0" class="mt-3">
          <p class="mb-2 text-xs font-medium text-gray-500">Agregar metodo:</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="am in availableMethods"
              :key="am.method"
              class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50"
              @click="startAddPayment(am.method)"
            >
              <Plus :size="12" class="mr-1 inline" />
              {{ am.label }}
            </button>
          </div>
        </div>

        <!-- Add payment form -->
        <div
          v-if="showAddPayment"
          class="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3"
        >
          <p class="mb-2 text-sm font-semibold text-gray-800">
            {{ newPaymentLabel }}
          </p>
          <div class="space-y-2">
            <div v-for="(_, field) in newPaymentDetails" :key="field">
              <label class="mb-1 block text-xs font-medium capitalize text-gray-600">
                {{ field }}
              </label>
              <input
                v-model="newPaymentDetails[field]"
                type="text"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              >
            </div>
          </div>
          <div class="mt-3 flex gap-2">
            <button
              class="flex-1 rounded-lg bg-gray-200 py-2 text-xs font-medium text-gray-700"
              @click="showAddPayment = false"
            >
              Cancelar
            </button>
            <button
              class="flex-1 rounded-lg bg-nova-primary py-2 text-xs font-medium text-white"
              @click="confirmAddPayment"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>

      <!-- Delivery -->
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              class="flex h-9 w-9 items-center justify-center rounded-lg"
              :class="deliveryEnabled ? 'bg-blue-50' : 'bg-gray-100'"
            >
              <Truck
                :size="18"
                :class="deliveryEnabled ? 'text-blue-600' : 'text-gray-400'"
              />
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900">Delivery</p>
              <p class="text-xs text-gray-500">Ofrecer entrega a domicilio</p>
            </div>
          </div>
          <button
            class="relative h-6 w-11 rounded-full transition-colors"
            :class="deliveryEnabled ? 'bg-green-500' : 'bg-gray-300'"
            @click="deliveryEnabled = !deliveryEnabled"
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
              :class="deliveryEnabled ? 'left-[22px]' : 'left-0.5'"
            />
          </button>
        </div>

        <div v-if="deliveryEnabled" class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">
              Costo de delivery (USD)
            </label>
            <input
              v-model="deliveryFee"
              type="number"
              step="0.5"
              min="0"
              placeholder="2.00"
              class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
            >
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">
              Zonas de delivery
            </label>
            <input
              v-model="deliveryZones"
              type="text"
              placeholder="Centro, Norte, Sur..."
              class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
            >
          </div>
        </div>
      </div>

      <!-- Welcome message & min order -->
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
            <MessageSquare :size="18" class="text-amber-600" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-900">Personalizacion</p>
            <p class="text-xs text-gray-500">Mensaje y reglas de la tienda</p>
          </div>
        </div>

        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">
              Mensaje de bienvenida
            </label>
            <textarea
              v-model="welcomeMessage"
              rows="2"
              placeholder="Bienvenido a nuestra tienda! Hacemos entregas de lunes a sabado."
              class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">
              Pedido minimo (USD)
            </label>
            <input
              v-model="minOrderAmount"
              type="number"
              step="0.5"
              min="0"
              placeholder="5.00"
              class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
            >
          </div>
        </div>
      </div>

      <!-- Save button -->
      <div>
        <button
          class="flex w-full items-center justify-center gap-2 rounded-lg bg-nova-primary py-3 text-sm font-medium text-white disabled:opacity-50"
          :disabled="isSaving"
          @click="saveSettings"
        >
          <Save :size="16" />
          {{ isSaving ? "Guardando..." : "Guardar configuracion" }}
        </button>

        <p
          v-if="saveSuccess"
          class="mt-3 text-center text-sm font-medium text-green-600"
        >
          Configuracion guardada
        </p>
        <p v-if="saveError" class="mt-3 text-center text-sm text-red-500">
          {{ saveError }}
        </p>
      </div>
    </div>
  </div>
</template>
