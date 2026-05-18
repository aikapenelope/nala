<script setup lang="ts">
/**
 * Onboarding flow after Clerk registration.
 *
 * Simplified to 2 screens:
 * 1. Business info: type + name + slug + owner name (single form)
 * 2. First product (optional): name + price — skip to go straight to POS
 *
 * Philosophy: "Nombre del negocio + primer producto = listo"
 *
 * Connected to:
 * - POST /onboarding (create business)
 * - POST /api/products (create first product, optional)
 * - GET /onboarding/check-slug/:slug (availability check)
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

// ============================================================
// Step 1: Business info (type + name + slug + owner)
// ============================================================

const step = ref<"business" | "product" | "done">("business");
const businessType = ref<BusinessType>("tienda");
const businessName = ref("");
const businessSlug = ref("");
const ownerName = ref("");
const isSubmitting = ref(false);
const slugAvailable = ref<boolean | null>(null);
const slugChecking = ref(false);
const error = ref("");

const config = useRuntimeConfig();
const tenantDomain = config.public.tenantDomain as string;

/** Business type options — simplified to 4 core types. */
const businessTypes: Array<{
  value: BusinessType;
  label: string;
  icon: string;
}> = [
  { value: "tienda", label: "Tienda", icon: "🏪" },
  { value: "moda", label: "Moda", icon: "👗" },
  { value: "servicios", label: "Servicios", icon: "✂️" },
  { value: "otro", label: "Otro", icon: "🏢" },
];

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
  slugAvailable.value = null;
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

/** Validate business form. */
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
  if (!canSubmit.value) return;

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
      businessId: result.user.businessId,
      businessName: result.business.name,
      businessSlug: null,
    });

    step.value = "product";
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

// ============================================================
// Step 2: First product (optional)
// ============================================================

const productName = ref("");
const productPrice = ref<number | null>(null);
const isCreatingProduct = ref(false);

async function createFirstProduct() {
  if (!productName.value.trim() || !productPrice.value || productPrice.value <= 0) return;
  isCreatingProduct.value = true;

  try {
    await $api("/api/products", {
      method: "POST",
      body: {
        name: productName.value.trim(),
        price: productPrice.value,
        stock: 999,
      },
    });
    step.value = "done";
  } catch {
    // If product creation fails, still let them proceed
    step.value = "done";
  } finally {
    isCreatingProduct.value = false;
  }
}

function skipProduct() {
  step.value = "done";
}

/** Navigate to POS after onboarding. */
function goToPOS() {
  router.push("/sales");
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-md">
      <!-- Step 1: Business info (single screen) -->
      <div v-if="step === 'business'">
        <div class="text-center">
          <h1 class="text-2xl font-extrabold text-gray-900">Crea tu negocio</h1>
          <p class="mt-1 text-sm text-gray-500">Solo necesitas nombre y tipo. 30 segundos.</p>
        </div>

        <div class="mt-6 space-y-4">
          <!-- Business type (compact pills) -->
          <div>
            <label class="mb-2 block text-xs font-medium text-gray-500">Tipo de negocio</label>
            <div class="flex gap-2">
              <button
                v-for="bt in businessTypes"
                :key="bt.value"
                class="flex-1 rounded-xl border-2 px-2 py-2.5 text-center transition-all"
                :class="
                  businessType === bt.value
                    ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                "
                @click="businessType = bt.value"
              >
                <span class="block text-lg">{{ bt.icon }}</span>
                <span class="block text-[11px] font-bold">{{ bt.label }}</span>
              </button>
            </div>
          </div>

          <!-- Business name -->
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500">Nombre del negocio</label>
            <input
              v-model="businessName"
              type="text"
              placeholder="Ej: Bodega Don Pedro"
              class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              autofocus
            >
          </div>

          <!-- Slug (auto-generated, editable) -->
          <div v-if="businessSlug">
            <div class="flex items-center gap-0">
              <input
                v-model="businessSlug"
                type="text"
                class="w-full rounded-l-xl border border-r-0 border-gray-300 px-3 py-2.5 text-xs font-medium focus:border-gray-900 focus:outline-none"
              >
              <span class="whitespace-nowrap rounded-r-xl border border-gray-300 bg-gray-50 px-2.5 py-2.5 text-[11px] text-gray-400">
                .{{ tenantDomain }}
              </span>
            </div>
            <p class="mt-1 text-[11px] text-gray-400">
              <template v-if="slugChecking">Verificando...</template>
              <template v-else-if="slugAvailable === true">
                <span class="text-green-600">Disponible</span>
              </template>
              <template v-else-if="slugAvailable === false">
                <span class="text-red-500">No disponible, elige otro</span>
              </template>
              <template v-else>URL de tu tienda online</template>
            </p>
          </div>

          <!-- Owner name -->
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500">Tu nombre</label>
            <input
              v-model="ownerName"
              type="text"
              placeholder="Ej: Pedro Rodriguez"
              class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
          </div>

          <p v-if="error" class="text-xs text-red-500">{{ error }}</p>

          <!-- Submit -->
          <button
            class="w-full rounded-xl bg-gray-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            :disabled="!canSubmit"
            @click="createBusiness"
          >
            {{ isSubmitting ? "Creando..." : "Continuar" }}
          </button>
        </div>
      </div>

      <!-- Step 2: First product (optional) -->
      <div v-else-if="step === 'product'" class="text-center">
        <h1 class="text-2xl font-extrabold text-gray-900">Agrega tu primer producto</h1>
        <p class="mt-1 text-sm text-gray-500">Opcional. Puedes agregar mas despues.</p>

        <div class="mt-6 space-y-4">
          <input
            v-model="productName"
            type="text"
            placeholder="Nombre del producto"
            class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            autofocus
          >
          <input
            v-model.number="productPrice"
            type="number"
            step="0.01"
            min="0"
            placeholder="Precio ($)"
            class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >

          <button
            class="w-full rounded-xl bg-gray-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            :disabled="!productName.trim() || !productPrice || productPrice <= 0 || isCreatingProduct"
            @click="createFirstProduct"
          >
            {{ isCreatingProduct ? "Creando..." : "Crear producto" }}
          </button>

          <button
            class="w-full py-2 text-xs font-medium text-gray-400 hover:text-gray-600"
            @click="skipProduct"
          >
            Saltar, lo hago despues
          </button>
        </div>
      </div>

      <!-- Step 3: Done -->
      <div v-else class="text-center">
        <div class="mb-4 text-5xl">✓</div>
        <h1 class="text-2xl font-extrabold text-gray-900">Listo!</h1>
        <p class="mt-2 text-sm text-gray-500">
          {{ businessName }} esta configurado. Ya puedes vender.
        </p>

        <div
          v-if="businessSlug"
          class="mx-auto mt-4 max-w-sm rounded-xl border border-gray-200 bg-gray-50 p-4"
        >
          <p class="text-xs text-gray-500">Tu tienda online</p>
          <p class="mt-1 text-sm font-bold text-gray-900">
            {{ businessSlug }}.{{ tenantDomain }}
          </p>
          <p class="mt-1 text-[11px] text-gray-400">
            Comparte este link con tus clientes
          </p>
        </div>

        <button
          class="mt-8 w-full rounded-xl bg-gray-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-gray-800"
          @click="goToPOS"
        >
          Ir a vender
        </button>
      </div>
    </div>
  </div>
</template>
