<script setup lang="ts">
/**
 * Store settings page - Shopify/Square-inspired setup experience.
 *
 * Two states:
 * 1. First time: Hero CTA to start setup
 * 2. Configured: Checklist with progress + expandable sections
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
  Check,
  Copy,
  ExternalLink,
  ShoppingBag,
} from "lucide-vue-next";

const { $api } = useApi();
const { user } = useNovaAuth();
const config = useRuntimeConfig();
const tenantDomain = config.public.tenantDomain as string;

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
const linkCopied = ref(false);
const activeSection = ref<string | null>(null);

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

/** Store URL. */
const storeUrl = computed(() => {
  const slug = user.value?.businessSlug;
  if (!slug) return null;
  return `https://${slug}.${tenantDomain}`;
});

/** Whether this is the first time (no settings exist yet). */
const isFirstTime = ref(false);

/** Checklist items. */
const checklist = computed(() => [
  {
    id: "slug",
    label: "URL de la tienda",
    done: !!user.value?.businessSlug,
    description: storeUrl.value ?? "Configura el slug de tu negocio",
  },
  {
    id: "payments",
    label: "Metodos de pago",
    done: paymentMethods.value.length > 0,
    description: paymentMethods.value.length > 0
      ? `${paymentMethods.value.length} metodo(s) configurado(s)`
      : "Agrega al menos un metodo de pago",
  },
  {
    id: "delivery",
    label: "Delivery (opcional)",
    done: true, // Always "done" since it's optional
    description: deliveryEnabled.value
      ? `Activo - $${Number(deliveryFee.value).toFixed(2)}`
      : "No configurado",
  },
  {
    id: "personalization",
    label: "Personalizacion",
    done: true, // Optional
    description: welcomeMessage.value || "Mensaje de bienvenida (opcional)",
  },
]);

/** Progress percentage. */
const progress = computed(() => {
  const required = checklist.value.filter((c) => c.id === "slug" || c.id === "payments");
  const done = required.filter((c) => c.done).length;
  return Math.round((done / required.length) * 100);
});

/** Can the store be enabled? */
const canEnable = computed(() => {
  return !!user.value?.businessSlug && paymentMethods.value.length > 0;
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

    // First time if no payment methods and store not enabled
    isFirstTime.value = !result.settings.storeEnabled && result.settings.paymentMethods.length === 0;
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
    isFirstTime.value = false;
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

/** Copy store URL to clipboard. */
async function copyLink() {
  if (!storeUrl.value) return;
  await navigator.clipboard.writeText(storeUrl.value);
  linkCopied.value = true;
  setTimeout(() => {
    linkCopied.value = false;
  }, 2000);
}

/** Toggle a section open/closed. */
function toggleSection(id: string) {
  activeSection.value = activeSection.value === id ? null : id;
}

/** Start first-time setup. */
function startSetup() {
  isFirstTime.value = false;
  activeSection.value = "payments";
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

    <!-- First time: Hero CTA -->
    <div
      v-else-if="isFirstTime"
      class="rounded-2xl bg-gradient-to-br from-[#F0FDF4] to-[#D1FAE5] p-8 text-center"
    >
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
        <ShoppingBag :size="28" class="text-green-600" />
      </div>
      <h2 class="text-lg font-bold text-gray-900">Crea tu tienda online</h2>
      <p class="mx-auto mt-2 max-w-sm text-sm text-gray-600">
        Tus clientes podran ver tu catalogo, hacer pedidos y pagarte directamente desde su celular.
      </p>
      <div class="mx-auto mt-4 max-w-xs space-y-2 text-left">
        <div class="flex items-center gap-2 text-xs text-gray-600">
          <Check :size="14" class="text-green-500" />
          <span>Catalogo con precios en USD y Bs</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-600">
          <Check :size="14" class="text-green-500" />
          <span>Checkout con Pago Movil, Binance, Zinli</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-600">
          <Check :size="14" class="text-green-500" />
          <span>Pedidos llegan a tu dashboard + WhatsApp</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-600">
          <Check :size="14" class="text-green-500" />
          <span>Installable como app en el celular del cliente</span>
        </div>
      </div>
      <button
        class="mt-6 rounded-xl bg-gray-900 px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-gray-800"
        @click="startSetup"
      >
        Configurar tienda
      </button>
    </div>

    <!-- Configured: Dashboard view -->
    <template v-else>
      <!-- Store toggle + URL -->
      <div class="mb-5 rounded-xl bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl"
              :class="storeEnabled ? 'bg-green-100' : 'bg-gray-100'"
            >
              <Store
                :size="20"
                :class="storeEnabled ? 'text-green-600' : 'text-gray-400'"
              />
            </div>
            <div>
              <p class="text-sm font-bold text-gray-900">
                {{ storeEnabled ? "Tienda activa" : "Tienda desactivada" }}
              </p>
              <p class="text-xs text-gray-500">
                {{ storeEnabled ? "Los clientes pueden hacer pedidos" : "No visible para clientes" }}
              </p>
            </div>
          </div>
          <button
            class="relative h-7 w-12 rounded-full transition-colors"
            :class="storeEnabled ? 'bg-green-500' : 'bg-gray-300'"
            :disabled="!canEnable && !storeEnabled"
            @click="storeEnabled = !storeEnabled"
          >
            <span
              class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
              :class="storeEnabled ? 'left-[22px]' : 'left-0.5'"
            />
          </button>
        </div>

        <!-- Cannot enable warning -->
        <p
          v-if="!canEnable && !storeEnabled"
          class="mt-2 text-xs text-amber-600"
        >
          Completa la configuracion para activar tu tienda.
        </p>

        <!-- Store URL (when slug exists) -->
        <div
          v-if="storeUrl"
          class="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5"
        >
          <Link :size="14" class="flex-shrink-0 text-gray-400" />
          <a
            :href="storeUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 truncate text-xs font-medium text-blue-600 hover:underline"
          >
            {{ storeUrl }}
          </a>
          <button
            class="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            :title="linkCopied ? 'Copiado!' : 'Copiar link'"
            @click="copyLink"
          >
            <Check v-if="linkCopied" :size="14" class="text-green-500" />
            <Copy v-else :size="14" />
          </button>
          <a
            :href="storeUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            title="Abrir tienda"
          >
            <ExternalLink :size="14" />
          </a>
        </div>

        <!-- No slug warning -->
        <div
          v-else
          class="mt-3 rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-3 py-2.5"
        >
          <p class="text-xs font-medium text-amber-700">
            Tu negocio no tiene un slug configurado. Configuralo en Negocio para obtener tu URL.
          </p>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="mb-5">
        <div class="mb-1.5 flex items-center justify-between">
          <p class="text-xs font-semibold text-gray-500">Configuracion</p>
          <p class="text-xs font-bold text-gray-700">{{ progress }}%</p>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            class="h-full rounded-full bg-green-500 transition-all duration-500"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>

      <!-- Checklist sections -->
      <div class="space-y-3">
        <!-- Payment methods section -->
        <div class="rounded-xl bg-white shadow-sm">
          <button
            class="flex w-full items-center gap-3 p-4"
            @click="toggleSection('payments')"
          >
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg"
              :class="paymentMethods.length > 0 ? 'bg-green-100' : 'bg-purple-50'"
            >
              <Check v-if="paymentMethods.length > 0" :size="14" class="text-green-600" />
              <CreditCard v-else :size="14" class="text-purple-600" />
            </div>
            <div class="flex-1 text-left">
              <p class="text-sm font-medium text-gray-900">Metodos de pago</p>
              <p class="text-xs text-gray-500">
                {{ paymentMethods.length > 0 ? `${paymentMethods.length} configurado(s)` : "Requerido" }}
              </p>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-gray-400 transition-transform"
              :class="activeSection === 'payments' ? 'rotate-180' : ''"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <!-- Expanded content -->
          <div v-if="activeSection === 'payments'" class="border-t border-gray-100 p-4">
            <!-- Existing methods -->
            <div v-if="paymentMethods.length > 0" class="mb-3 space-y-2">
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

            <!-- Add payment buttons -->
            <div v-if="!showAddPayment && availableMethods.length > 0">
              <p class="mb-2 text-xs font-medium text-gray-500">Agregar:</p>
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
              class="rounded-lg border border-blue-200 bg-blue-50/50 p-3"
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
        </div>

        <!-- Delivery section -->
        <div class="rounded-xl bg-white shadow-sm">
          <button
            class="flex w-full items-center gap-3 p-4"
            @click="toggleSection('delivery')"
          >
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg"
              :class="deliveryEnabled ? 'bg-blue-100' : 'bg-gray-100'"
            >
              <Truck :size="14" :class="deliveryEnabled ? 'text-blue-600' : 'text-gray-400'" />
            </div>
            <div class="flex-1 text-left">
              <p class="text-sm font-medium text-gray-900">Delivery</p>
              <p class="text-xs text-gray-500">
                {{ deliveryEnabled ? `$${Number(deliveryFee).toFixed(2)}` : "Opcional" }}
              </p>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-gray-400 transition-transform"
              :class="activeSection === 'delivery' ? 'rotate-180' : ''"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <div v-if="activeSection === 'delivery'" class="border-t border-gray-100 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-sm text-gray-700">Ofrecer delivery</p>
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
            <template v-if="deliveryEnabled">
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600">Costo (USD)</label>
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
                <label class="mb-1 block text-xs font-medium text-gray-600">Zonas</label>
                <input
                  v-model="deliveryZones"
                  type="text"
                  placeholder="Centro, Norte, Sur..."
                  class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
                >
              </div>
            </template>
          </div>
        </div>

        <!-- Personalization section -->
        <div class="rounded-xl bg-white shadow-sm">
          <button
            class="flex w-full items-center gap-3 p-4"
            @click="toggleSection('personalization')"
          >
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <MessageSquare :size="14" class="text-amber-600" />
            </div>
            <div class="flex-1 text-left">
              <p class="text-sm font-medium text-gray-900">Personalizacion</p>
              <p class="text-xs text-gray-500">Mensaje y pedido minimo</p>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-gray-400 transition-transform"
              :class="activeSection === 'personalization' ? 'rotate-180' : ''"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <div v-if="activeSection === 'personalization'" class="border-t border-gray-100 p-4 space-y-3">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600">Mensaje de bienvenida</label>
              <textarea
                v-model="welcomeMessage"
                rows="2"
                placeholder="Bienvenido a nuestra tienda! Hacemos entregas de lunes a sabado."
                class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600">Pedido minimo (USD)</label>
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
      </div>

      <!-- Save button -->
      <div class="mt-5">
        <button
          class="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3.5 text-sm font-bold text-white disabled:opacity-50"
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
    </template>
  </div>
</template>
