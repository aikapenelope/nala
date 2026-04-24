<script setup lang="ts">
/**
 * Onboarding flow after Clerk registration.
 *
 * Step 1: "What type of business do you have?" (visual selector)
 * Step 2: Business name + owner name
 * Step 3: Done - Nova pre-configures categories and accounts
 *
 * Connected to: POST /onboarding
 */

import type { BusinessType } from "@nova/shared";

definePageMeta({ layout: false });

const router = useRouter();
const { setUser, isAuthenticated, resolveUser } = useNovaAuth();
const { $api } = useApi();

/**
 * Guard: require a Clerk session before showing onboarding.
 * If the user already has a NovaUser (completed onboarding), go to dashboard.
 * If no Clerk session, redirect to sign-up first.
 */
onMounted(() => {
  if (isAuthenticated.value) {
    router.replace("/");
    return;
  }

  if (import.meta.client) {
    try {
      const { isSignedIn } = useAuth();
      if (!isSignedIn.value) {
        router.replace("/auth/signup");
      }
    } catch {
      // Clerk not ready -- allow page to render, the API call will fail
      // with a clear error if there's no session
    }
  }
});

const step = ref(1);
const businessType = ref<BusinessType | null>(null);
const businessName = ref("");
const businessSlug = ref("");
const ownerName = ref("");
const isSubmitting = ref(false);
const slugAvailable = ref<boolean | null>(null);
const slugChecking = ref(false);
const error = ref("");

const config = useRuntimeConfig();
const tenantDomain = config.public.tenantDomain as string;

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

/** Generate a URL-friendly slug from a business name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
    .slice(0, 40); // max length
}

/** Auto-generate slug when business name changes. */
watch(businessName, (name) => {
  businessSlug.value = slugify(name);
  slugAvailable.value = null; // reset availability check
});

/** Check slug availability (debounced). */
let slugCheckTimeout: ReturnType<typeof setTimeout> | null = null;
watch(businessSlug, (slug) => {
  slugAvailable.value = null;
  if (slugCheckTimeout) clearTimeout(slugCheckTimeout);
  if (!slug || slug.length < 3) return;

  slugCheckTimeout = setTimeout(async () => {
    slugChecking.value = true;
    try {
      const result = await $api<{ available: boolean }>(
        `/onboarding/check-slug/${encodeURIComponent(slug)}`,
      );
      slugAvailable.value = result.available;
    } catch {
      slugAvailable.value = null;
    } finally {
      slugChecking.value = false;
    }
  }, 500);
});

/** Validate step 2 fields. */
const canSubmit = computed(() => {
  return (
    businessName.value.trim().length > 0 &&
    businessSlug.value.length >= 3 &&
    slugAvailable.value !== false &&
    ownerName.value.trim().length > 0 &&
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
        businessSlug: businessSlug.value,
        ownerName: ownerName.value.trim(),
      },
    });

    // Set the Nova user directly from the onboarding response
    setUser({
      id: result.user.id,
      name: result.user.name,
      role: result.user.role as "owner" | "employee",
      businessId: result.user.businessId,
      businessName: result.business.name,
    });

    step.value = 3;
  } catch (err) {
    const fetchError = err as {
      data?: { error?: string; businessId?: string };
      statusCode?: number;
    };

    // 409 means user already has a business -- go to dashboard
    if (fetchError.statusCode === 409) {
      await resolveUser();
      router.replace("/");
      return;
    }

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
              URL de tu negocio
            </label>
            <div class="flex items-center gap-0">
              <input
                v-model="businessSlug"
                type="text"
                placeholder="bodega-don-pedro"
                class="w-full rounded-l-xl border border-r-0 border-gray-300 px-4 py-3 text-sm focus:border-nova-primary focus:outline-none focus:ring-2 focus:ring-nova-primary/20"
              />
              <span
                class="whitespace-nowrap rounded-r-xl border border-gray-300 bg-gray-50 px-3 py-3 text-xs text-gray-400"
              >
                .{{ tenantDomain }}
              </span>
            </div>
            <p class="mt-1 text-left text-xs text-gray-400">
              <template v-if="slugChecking">Verificando...</template>
              <template v-else-if="slugAvailable === true">
                <span class="text-green-600">Disponible</span>
              </template>
              <template v-else-if="slugAvailable === false">
                <span class="text-red-500">No disponible, elige otro</span>
              </template>
              <template v-else> Tus clientes veran esta URL </template>
            </p>
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

        <div
          v-if="businessSlug"
          class="mx-auto mt-4 max-w-sm rounded-xl border border-gray-200 bg-gray-50 p-4"
        >
          <p class="text-xs text-gray-500">Tu URL publica</p>
          <p class="mt-1 text-sm font-medium text-nova-primary">
            {{ businessSlug }}.{{ tenantDomain }}
          </p>
          <p class="mt-1 text-xs text-gray-400">
            Comparte este link con tus clientes para que vean tu catalogo
          </p>
        </div>

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
