<script setup lang="ts">
/**
 * Onboarding flow after Clerk registration.
 *
 * Step 1: "What type of business do you have?" (visual selector)
 * Step 2: Business name + owner name + PIN
 * Step 3: Done - Nova pre-configures categories and accounts
 *
 * Connected to: POST /onboarding
 */

import { PIN_LENGTH } from "@nova/shared";
import type { BusinessType } from "@nova/shared";

definePageMeta({ layout: false });

const router = useRouter();
const { setUser } = useNovaAuth();
const { $api } = useApi();

const step = ref(1);
const businessType = ref<BusinessType | null>(null);
const businessName = ref("");
const ownerName = ref("");
const ownerPin = ref("");
const isSubmitting = ref(false);
const error = ref("");

/** Business type options with visual labels. */
const businessTypes: Array<{
  value: BusinessType;
  label: string;
  icon: string;
}> = [
  { value: "ferreteria", label: "Ferreteria", icon: "wrench" },
  { value: "bodega", label: "Bodega", icon: "store" },
  { value: "ropa", label: "Tienda de ropa", icon: "shirt" },
  { value: "autopartes", label: "Autopartes", icon: "car" },
  { value: "peluqueria", label: "Peluqueria", icon: "scissors" },
  { value: "farmacia", label: "Farmacia", icon: "pill" },
  { value: "electronica", label: "Electronica", icon: "monitor" },
  { value: "libreria", label: "Libreria", icon: "book" },
  { value: "cosmeticos", label: "Cosmeticos", icon: "sparkles" },
  { value: "distribuidora", label: "Distribuidora", icon: "truck" },
  { value: "otro", label: "Otro", icon: "building" },
];

function selectType(type: BusinessType) {
  businessType.value = type;
  step.value = 2;
}

/** Validate step 2 fields. */
const canSubmit = computed(() => {
  return (
    businessName.value.trim().length > 0 &&
    ownerName.value.trim().length > 0 &&
    ownerPin.value.length === PIN_LENGTH &&
    !isSubmitting.value
  );
});

async function createBusiness() {
  if (!businessType.value || !canSubmit.value) return;

  isSubmitting.value = true;
  error.value = "";

  try {
    const result = await $api<{
      business: { id: string; name: string; type: string };
      user: { id: string; name: string; role: string; businessId: string };
    }>("/onboarding", {
      method: "POST",
      body: {
        businessType: businessType.value,
        businessName: businessName.value.trim(),
        ownerName: ownerName.value.trim(),
        ownerPin: ownerPin.value,
      },
    });

    // Set the Nova user from the onboarding response
    setUser({
      id: result.user.id,
      name: result.user.name,
      role: result.user.role as "owner" | "employee",
      businessId: result.user.businessId,
    });

    // Store businessId for PIN screen
    if (import.meta.client) {
      localStorage.setItem("nova:businessId", result.business.id);
    }

    step.value = 3;
  } catch (err) {
    const fetchError = err as {
      data?: { error?: string };
      statusCode?: number;
    };

    if (fetchError.data?.error) {
      error.value = fetchError.data.error;
    } else {
      error.value = "Error al crear el negocio. Intenta de nuevo.";
    }
  } finally {
    isSubmitting.value = false;
  }
}

/** Navigate to dashboard after onboarding. */
function goToDashboard() {
  router.push("/");
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-lg">
      <!-- Step 1: Business type -->
      <div v-if="step === 1" class="text-center">
        <h1 class="text-2xl font-bold text-gray-900">Bienvenido a Nova</h1>
        <p class="mt-2 text-gray-500">Que tipo de negocio tienes?</p>

        <div class="mt-8 grid grid-cols-3 gap-3">
          <button
            v-for="bt in businessTypes"
            :key="bt.value"
            class="flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors"
            :class="
              businessType === bt.value
                ? 'border-nova-primary bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            "
            @click="selectType(bt.value)"
          >
            <span class="text-2xl">{{ bt.icon }}</span>
            <span class="text-xs font-medium text-gray-700">{{
              bt.label
            }}</span>
          </button>
        </div>
      </div>

      <!-- Step 2: Business name + owner info -->
      <div v-else-if="step === 2" class="text-center">
        <h1 class="text-2xl font-bold text-gray-900">Configura tu negocio</h1>
        <p class="mt-2 text-gray-500">
          Estos datos se usan para recibos y acceso
        </p>

        <div class="mt-8 space-y-4">
          <div>
            <label class="mb-1 block text-left text-sm text-gray-600">
              Nombre del negocio
            </label>
            <input
              v-model="businessName"
              type="text"
              placeholder="Ej: Bodega Don Pedro"
              class="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg focus:border-nova-primary focus:outline-none focus:ring-2 focus:ring-nova-primary/20"
              autofocus
            />
          </div>

          <div>
            <label class="mb-1 block text-left text-sm text-gray-600">
              Tu nombre
            </label>
            <input
              v-model="ownerName"
              type="text"
              placeholder="Ej: Pedro Rodriguez"
              class="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-nova-primary focus:outline-none focus:ring-2 focus:ring-nova-primary/20"
            />
          </div>

          <div>
            <label class="mb-1 block text-left text-sm text-gray-600">
              PIN de acceso ({{ PIN_LENGTH }} digitos)
            </label>
            <input
              v-model="ownerPin"
              type="password"
              inputmode="numeric"
              :maxlength="PIN_LENGTH"
              placeholder="0000"
              class="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-2xl tracking-[0.5em] focus:border-nova-primary focus:outline-none focus:ring-2 focus:ring-nova-primary/20"
              @keyup.enter="createBusiness"
            />
            <p class="mt-1 text-left text-xs text-gray-400">
              Este PIN lo usaras para acceder y autorizar acciones
            </p>
          </div>

          <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

          <div class="flex gap-3 pt-2">
            <button
              class="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700"
              @click="step = 1"
            >
              Atras
            </button>
            <button
              class="flex-1 rounded-xl bg-nova-primary py-3 text-sm font-medium text-white disabled:opacity-50"
              :disabled="!canSubmit"
              @click="createBusiness"
            >
              {{ isSubmitting ? "Creando..." : "Crear negocio" }}
            </button>
          </div>
        </div>
      </div>

      <!-- Step 3: Done -->
      <div v-else class="text-center">
        <div class="mb-4 text-5xl">✓</div>
        <h1 class="text-2xl font-bold text-gray-900">Listo!</h1>
        <p class="mt-2 text-gray-500">
          {{ businessName }} esta configurado. Nova pre-configuro categorias y
          cuentas contables para tu tipo de negocio.
        </p>

        <button
          class="mt-8 inline-block rounded-xl bg-nova-primary px-8 py-3 font-medium text-white"
          @click="goToDashboard"
        >
          Ir al dashboard
        </button>
      </div>
    </div>
  </div>
</template>
