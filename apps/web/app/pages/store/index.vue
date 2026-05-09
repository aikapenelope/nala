<script setup lang="ts">
/**
 * Online Store management page.
 *
 * Visible in the sidebar. Allows the owner to configure and manage
 * their public storefront (PWA web + mobile).
 *
 * Handles gracefully when API is not reachable (shows setup wizard).
 */

import {
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
  Smartphone,
  Globe,
  Share2,
  Eye,
  ShoppingCart,
  DollarSign,
  Clock,
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
const isSaving = ref(false);
const saveSuccess = ref(false);
const saveError = ref("");
const linkCopied = ref(false);
const showSetup = ref(false);

// Payment method form
const showAddPayment = ref(false);
const newPaymentMethod = ref("");
const newPaymentLabel = ref("");
const newPaymentDetails = ref<Record<string, string>>({});

const paymentTemplates: Record<string, { label: string; fields: string[] }> = {
  pago_movil: { label: "Pago Movil", fields: ["banco", "telefono", "cedula"] },
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
  return `https://${slug}.novaincs.com`;
});

/** Can enable store? */
const canEnable = computed(() => !!user.value?.businessSlug && paymentMethods.value.length > 0);

/** Available methods not yet added. */
const availableMethods = computed(() => {
  const added = new Set(paymentMethods.value.map((pm) => pm.method));
  return Object.entries(paymentTemplates)
    .filter(([key]) => !added.has(key))
    .map(([key, val]) => ({ method: key, label: val.label }));
});

async function fetchSettings() {
  isLoading.value = true;
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
    showSetup.value = !result.settings.storeEnabled && result.settings.paymentMethods.length === 0;
  } catch {
    // API failed - show setup wizard instead of error
    showSetup.value = true;
  } finally {
    isLoading.value = false;
  }
}

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
    showSetup.value = false;
    setTimeout(() => { saveSuccess.value = false; }, 3000);
  } catch (err) {
    const e = err as { data?: { error?: string } };
    saveError.value = e.data?.error ?? "Error al guardar";
  } finally {
    isSaving.value = false;
  }
}

async function copyLink() {
  if (!storeUrl.value) return;
  await navigator.clipboard.writeText(storeUrl.value);
  linkCopied.value = true;
  setTimeout(() => { linkCopied.value = false; }, 2000);
}

// --- Share store ---

const instagramCopied = ref(false);

/** Whether the browser supports the Web Share API. */
const hasWebShare = computed(() => import.meta.client && !!navigator.share);

/** Share via WhatsApp (opens wa.me with pre-built message). */
function shareWhatsApp() {
  if (!storeUrl.value) return;
  const businessName = user.value?.businessName ?? "mi tienda";
  const text = `Visita ${businessName}: ${storeUrl.value}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

/** Copy link for Instagram bio. */
async function shareInstagram() {
  if (!storeUrl.value) return;
  await navigator.clipboard.writeText(storeUrl.value);
  instagramCopied.value = true;
  setTimeout(() => { instagramCopied.value = false; }, 3000);
}

/** Native share via Web Share API. */
async function shareNative() {
  if (!storeUrl.value || !navigator.share) return;
  const businessName = user.value?.businessName ?? "Mi tienda";
  try {
    await navigator.share({
      title: businessName,
      text: `Visita ${businessName}`,
      url: storeUrl.value,
    });
  } catch {
    // User cancelled or share failed — silently ignore
  }
}

// --- Store stats ---

const storeStats = ref<{
  ordersThisWeek: number;
  revenueThisWeek: number;
  pendingOrders: number;
} | null>(null);

async function fetchStoreStats() {
  try {
    const result = await $api<{
      stats: {
        ordersThisWeek: number;
        revenueThisWeek: number;
        pendingOrders: number;
      };
    }>("/api/store-stats");
    storeStats.value = result.stats;
  } catch {
    // Non-critical — stats just won't show
  }
}

function startAddPayment(method: string) {
  const t = paymentTemplates[method];
  if (!t) return;
  newPaymentMethod.value = method;
  newPaymentLabel.value = t.label;
  newPaymentDetails.value = {};
  for (const f of t.fields) newPaymentDetails.value[f] = "";
  showAddPayment.value = true;
}

function confirmAddPayment() {
  if (!newPaymentMethod.value) return;
  paymentMethods.value.push({ method: newPaymentMethod.value, label: newPaymentLabel.value, details: { ...newPaymentDetails.value } });
  showAddPayment.value = false;
}

function removePayment(idx: number) {
  paymentMethods.value.splice(idx, 1);
}

onMounted(() => {
  fetchSettings();
  fetchStoreStats();
});
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-5">
      <h1 class="text-2xl font-extrabold tracking-tight text-gradient">Tienda Online</h1>
      <p class="mt-0.5 text-sm text-gray-500">Tu tienda publica PWA (web + movil)</p>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="animate-pulse space-y-3 py-8">
      <div class="h-32 rounded-2xl bg-white/50" />
      <div class="h-24 rounded-2xl bg-white/50" />
    </div>

    <template v-else>
      <!-- Setup wizard (first time or API error) -->
      <div v-if="showSetup && paymentMethods.length === 0" class="rounded-2xl bg-gradient-to-br from-[#F0FDF4] to-[#D1FAE5] p-8 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
          <ShoppingBag :size="28" class="text-green-600" />
        </div>
        <h2 class="text-lg font-bold text-gray-900">Crea tu tienda online</h2>
        <p class="mx-auto mt-2 max-w-sm text-sm text-gray-600">
          Tus clientes podran ver tu catalogo, hacer pedidos y pagarte desde su celular. Installable como app (PWA).
        </p>
        <div class="mx-auto mt-4 max-w-xs space-y-2 text-left">
          <div class="flex items-center gap-2 text-xs text-gray-600"><Check :size="14" class="text-green-500" /><span>Catalogo con precios en USD y Bs</span></div>
          <div class="flex items-center gap-2 text-xs text-gray-600"><Check :size="14" class="text-green-500" /><span>Checkout con Pago Movil, Binance, Zinli</span></div>
          <div class="flex items-center gap-2 text-xs text-gray-600"><Check :size="14" class="text-green-500" /><span>Pedidos llegan a tu dashboard + WhatsApp</span></div>
          <div class="flex items-center gap-2 text-xs text-gray-600"><Smartphone :size="14" class="text-green-500" /><span>Installable como app en el celular</span></div>
          <div class="flex items-center gap-2 text-xs text-gray-600"><Globe :size="14" class="text-green-500" /><span>URL propia: tunegocio.novaincs.com</span></div>
        </div>
        <button class="mt-6 rounded-xl bg-gray-900 px-8 py-3 text-sm font-bold text-white hover:bg-gray-800" @click="showSetup = false">
          Configurar tienda
        </button>
      </div>

      <!-- Store management -->
      <div v-else class="space-y-4">
        <!-- Status + URL card -->
        <div class="card-premium p-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl" :class="storeEnabled ? 'bg-green-100' : 'bg-gray-100'">
                <Store :size="20" :class="storeEnabled ? 'text-green-600' : 'text-gray-400'" />
              </div>
              <div>
                <p class="text-sm font-bold text-gray-900">{{ storeEnabled ? "Tienda activa" : "Tienda desactivada" }}</p>
                <p class="text-xs text-gray-500">{{ storeEnabled ? "Clientes pueden hacer pedidos" : "No visible al publico" }}</p>
              </div>
            </div>
            <button
              class="relative h-7 w-12 rounded-full transition-colors"
              :class="storeEnabled ? 'bg-green-500' : 'bg-gray-300'"
              :disabled="!canEnable && !storeEnabled"
              @click="storeEnabled = !storeEnabled"
            >
              <span class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform" :class="storeEnabled ? 'left-[22px]' : 'left-0.5'" />
            </button>
          </div>
          <p v-if="!canEnable && !storeEnabled" class="mt-2 text-xs text-amber-600">Agrega al menos un metodo de pago para activar.</p>

          <!-- Store URL -->
          <div v-if="storeUrl" class="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
            <Link :size="14" class="flex-shrink-0 text-gray-400" />
            <a :href="storeUrl" target="_blank" rel="noopener noreferrer" class="flex-1 truncate text-sm font-medium text-blue-600 hover:underline">{{ storeUrl }}</a>
            <button class="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-700" @click="copyLink">
              <Check v-if="linkCopied" :size="14" class="text-green-500" />
              <Copy v-else :size="14" />
            </button>
            <a :href="storeUrl" target="_blank" rel="noopener noreferrer" class="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-700">
              <ExternalLink :size="14" />
            </a>
          </div>
          <div v-else class="mt-3 rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-3 py-2.5">
            <p class="text-xs text-amber-700">Tu negocio no tiene slug. Configuralo en Config. &gt; Negocio.</p>
          </div>

          <!-- Preview store button -->
          <a
            v-if="storeUrl && storeEnabled"
            :href="storeUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            <Eye :size="16" class="text-gray-500" />
            Ver como se ve tu tienda
          </a>
        </div>

        <!-- Store stats -->
        <div v-if="storeStats && storeEnabled" class="grid grid-cols-3 gap-2.5">
          <NuxtLink
            to="/orders"
            class="card-premium flex flex-col items-center gap-1 p-3.5 text-center transition-spring hover:shadow-[0_8px_20px_-5px_rgba(0,0,0,0.06)]"
          >
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <ShoppingCart :size="14" class="text-blue-600" />
            </div>
            <p class="text-lg font-extrabold text-gray-900">{{ storeStats.ordersThisWeek }}</p>
            <p class="text-[10px] font-semibold text-gray-500">Pedidos semana</p>
          </NuxtLink>
          <div class="card-premium flex flex-col items-center gap-1 p-3.5 text-center">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
              <DollarSign :size="14" class="text-green-600" />
            </div>
            <p class="text-lg font-extrabold text-gray-900">${{ storeStats.revenueThisWeek.toFixed(0) }}</p>
            <p class="text-[10px] font-semibold text-gray-500">Ingresos semana</p>
          </div>
          <NuxtLink
            to="/orders"
            class="card-premium flex flex-col items-center gap-1 p-3.5 text-center transition-spring hover:shadow-[0_8px_20px_-5px_rgba(0,0,0,0.06)]"
          >
            <div class="flex h-8 w-8 items-center justify-center rounded-lg" :class="storeStats.pendingOrders > 0 ? 'bg-amber-50' : 'bg-gray-50'">
              <Clock :size="14" :class="storeStats.pendingOrders > 0 ? 'text-amber-600' : 'text-gray-400'" />
            </div>
            <p class="text-lg font-extrabold text-gray-900">{{ storeStats.pendingOrders }}</p>
            <p class="text-[10px] font-semibold text-gray-500">Pendientes</p>
          </NuxtLink>
        </div>

        <!-- Share store -->
        <div v-if="storeUrl && storeEnabled" class="card-premium p-5">
          <div class="mb-3 flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Share2 :size="18" class="text-blue-600" />
            </div>
            <div>
              <p class="text-sm font-bold text-gray-900">Compartir tu tienda</p>
              <p class="text-xs text-gray-500">Envia el link a tus clientes</p>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <!-- WhatsApp -->
            <button
              class="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-green-300 hover:bg-green-50"
              @click="shareWhatsApp"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </button>

            <!-- Instagram -->
            <button
              class="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-pink-300 hover:bg-pink-50"
              @click="shareInstagram"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E1306C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
              {{ instagramCopied ? "Link copiado!" : "Instagram" }}
            </button>

            <!-- Native share (Web Share API) -->
            <button
              v-if="hasWebShare"
              class="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
              @click="shareNative"
            >
              <Share2 :size="16" class="text-gray-500" />
              Compartir
            </button>
          </div>

          <!-- Instagram instructions -->
          <p
            v-if="instagramCopied"
            class="mt-2 text-xs text-pink-600"
          >
            Pega el link en tu bio de Instagram.
          </p>
        </div>

        <!-- Payment methods -->
        <div class="card-premium p-5">
          <div class="mb-3 flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50"><CreditCard :size="18" class="text-purple-600" /></div>
            <div>
              <p class="text-sm font-bold text-gray-900">Metodos de pago</p>
              <p class="text-xs text-gray-500">Datos que ve el cliente al pagar</p>
            </div>
          </div>

          <div v-if="paymentMethods.length > 0" class="space-y-2">
            <div v-for="(pm, idx) in paymentMethods" :key="idx" class="flex items-start justify-between rounded-lg border border-gray-100 p-3">
              <div>
                <p class="text-sm font-semibold text-gray-800">{{ pm.label }}</p>
                <p v-for="(val, key) in pm.details" :key="key" class="text-xs text-gray-500"><span class="capitalize text-gray-600">{{ key }}:</span> {{ val }}</p>
              </div>
              <button class="text-gray-400 hover:text-red-500" @click="removePayment(idx)"><Trash2 :size="14" /></button>
            </div>
          </div>
          <p v-else class="py-3 text-center text-xs text-gray-400">Sin metodos de pago configurados</p>

          <!-- Add buttons -->
          <div v-if="!showAddPayment && availableMethods.length > 0" class="mt-3 flex flex-wrap gap-2">
            <button v-for="am in availableMethods" :key="am.method" class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50" @click="startAddPayment(am.method)">
              <Plus :size="12" class="mr-1 inline" />{{ am.label }}
            </button>
          </div>

          <!-- Add form -->
          <div v-if="showAddPayment" class="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <p class="mb-2 text-sm font-semibold text-gray-800">{{ newPaymentLabel }}</p>
            <div class="space-y-2">
              <div v-for="(_, field) in newPaymentDetails" :key="field">
                <label class="mb-1 block text-xs font-medium capitalize text-gray-600">{{ field }}</label>
                <input v-model="newPaymentDetails[field]" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none">
              </div>
            </div>
            <div class="mt-3 flex gap-2">
              <button class="flex-1 rounded-lg bg-gray-200 py-2 text-xs font-medium text-gray-700" @click="showAddPayment = false">Cancelar</button>
              <button class="flex-1 rounded-lg bg-nova-primary py-2 text-xs font-medium text-white" @click="confirmAddPayment">Agregar</button>
            </div>
          </div>
        </div>

        <!-- Delivery -->
        <div class="card-premium p-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 items-center justify-center rounded-lg" :class="deliveryEnabled ? 'bg-blue-50' : 'bg-gray-100'">
                <Truck :size="18" :class="deliveryEnabled ? 'text-blue-600' : 'text-gray-400'" />
              </div>
              <div>
                <p class="text-sm font-bold text-gray-900">Delivery</p>
                <p class="text-xs text-gray-500">Entrega a domicilio</p>
              </div>
            </div>
            <button class="relative h-6 w-11 rounded-full transition-colors" :class="deliveryEnabled ? 'bg-green-500' : 'bg-gray-300'" @click="deliveryEnabled = !deliveryEnabled">
              <span class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform" :class="deliveryEnabled ? 'left-[22px]' : 'left-0.5'" />
            </button>
          </div>
          <div v-if="deliveryEnabled" class="mt-3 space-y-3">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600">Costo (USD)</label>
              <input v-model="deliveryFee" type="number" step="0.5" min="0" placeholder="2.00" class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none">
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600">Zonas</label>
              <input v-model="deliveryZones" type="text" placeholder="Centro, Norte, Sur..." class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none">
            </div>
          </div>
        </div>

        <!-- Personalization -->
        <div class="card-premium p-5">
          <div class="mb-3 flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50"><MessageSquare :size="18" class="text-amber-600" /></div>
            <div>
              <p class="text-sm font-bold text-gray-900">Personalizacion</p>
              <p class="text-xs text-gray-500">Mensaje y reglas</p>
            </div>
          </div>
          <div class="space-y-3">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600">Mensaje de bienvenida</label>
              <textarea v-model="welcomeMessage" rows="2" placeholder="Bienvenido! Hacemos entregas de lunes a sabado." class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600">Pedido minimo (USD)</label>
              <input v-model="minOrderAmount" type="number" step="0.5" min="0" placeholder="5.00" class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none">
            </div>
          </div>
        </div>

        <!-- Save -->
        <button
          class="dark-pill flex w-full items-center justify-center gap-2 rounded-[20px] py-4 text-[15px] font-extrabold tracking-wide transition-spring disabled:opacity-50"
          :disabled="isSaving"
          @click="saveSettings"
        >
          <Save :size="18" />
          {{ isSaving ? "Guardando..." : "Guardar configuracion" }}
        </button>
        <p v-if="saveSuccess" class="mt-2 text-center text-sm font-medium text-green-600">Configuracion guardada</p>
        <p v-if="saveError" class="mt-2 text-center text-sm text-red-500">{{ saveError }}</p>
      </div>
    </template>
  </div>
</template>
