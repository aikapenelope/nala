<script setup lang="ts">
/**
 * Product creation/edit form.
 *
 * Desktop: full form with all fields visible.
 * Mobile: stacked form with sections.
 *
 * Supports:
 * - Basic info: name, description, category, SKU, barcode
 * - Pricing: cost, price (margin auto-calculated)
 * - Stock: current stock, min threshold, critical threshold
 * - Variants: add talla/color/referencia combinations
 * - Image upload (placeholder for MinIO integration)
 */

definePageMeta({ middleware: ["admin-only"] });

const route = useRoute();
const isEditing = computed(() => route.params.id !== "new");

const form = reactive({
  name: "",
  description: "",
  categoryId: "",
  sku: "",
  barcode: "",
  cost: 0,
  price: 0,
  stock: 0,
  stockMin: 5,
  stockCritical: 2,
  hasVariants: false,
  expiresAt: "",
});

/** Computed margin percentage. */
const marginPercent = computed(() => {
  if (form.price === 0) return "0";
  return (((form.price - form.cost) / form.price) * 100).toFixed(1);
});

/** Variant management. */
const variants = ref<
  Array<{
    id: string;
    attributes: Record<string, string>;
    sku: string;
    cost: number;
    price: number;
    stock: number;
  }>
>([]);

const variantAttributeKeys = ref<string[]>([]);
const newAttributeKey = ref("");

function addAttributeKey() {
  const key = newAttributeKey.value.trim();
  if (key && !variantAttributeKeys.value.includes(key)) {
    variantAttributeKeys.value.push(key);
    newAttributeKey.value = "";
  }
}

function removeAttributeKey(key: string) {
  variantAttributeKeys.value = variantAttributeKeys.value.filter(
    (k) => k !== key,
  );
  // Remove attribute from all variants by rebuilding attributes object
  for (const v of variants.value) {
    const newAttrs: Record<string, string> = {};
    for (const [k, val] of Object.entries(v.attributes)) {
      if (k !== key) newAttrs[k] = val;
    }
    v.attributes = newAttrs;
  }
}

function addVariant() {
  const attrs: Record<string, string> = {};
  for (const key of variantAttributeKeys.value) {
    attrs[key] = "";
  }
  variants.value.push({
    id: crypto.randomUUID(),
    attributes: attrs,
    sku: "",
    cost: form.cost,
    price: form.price,
    stock: 0,
  });
}

function removeVariant(id: string) {
  variants.value = variants.value.filter((v) => v.id !== id);
}

const isSubmitting = ref(false);
const error = ref("");

async function submitForm() {
  if (!form.name.trim() || form.price <= 0) {
    error.value = "Nombre y precio son obligatorios";
    return;
  }

  isSubmitting.value = true;
  error.value = "";

  try {
    // TODO: Call API to create/update product
    // If hasVariants, also create variants
    await navigateTo("/inventory");
  } catch {
    error.value = "Error al guardar el producto";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">
        {{ isEditing ? "Editar producto" : "Nuevo producto" }}
      </h1>
      <NuxtLink
        to="/inventory"
        class="text-sm text-gray-500 hover:text-gray-700"
      >
        Cancelar
      </NuxtLink>
    </div>

    <form @submit.prevent="submitForm" class="space-y-6">
      <!-- Basic info -->
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <h2 class="mb-4 text-sm font-semibold text-gray-700">
          Información básica
        </h2>

        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-sm text-gray-600">Nombre *</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="Ej: Harina PAN 1kg"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              required
            />
          </div>

          <div>
            <label class="mb-1 block text-sm text-gray-600">Descripción</label>
            <textarea
              v-model="form.description"
              rows="2"
              placeholder="Descripción opcional"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-1 block text-sm text-gray-600">SKU</label>
              <input
                v-model="form.sku"
                type="text"
                placeholder="HP-001"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600">
                Código de barras
              </label>
              <input
                v-model="form.barcode"
                type="text"
                placeholder="7591234567890"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Pricing -->
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <h2 class="mb-4 text-sm font-semibold text-gray-700">Precios (USD)</h2>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="mb-1 block text-sm text-gray-600">Costo</label>
            <input
              v-model.number="form.cost"
              type="number"
              step="0.01"
              min="0"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600">
              Precio de venta *
            </label>
            <input
              v-model.number="form.price"
              type="number"
              step="0.01"
              min="0"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              required
            />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600">Margen</label>
            <div
              class="flex h-[38px] items-center rounded-lg bg-gray-50 px-3 text-sm text-gray-700"
            >
              {{ marginPercent }}%
            </div>
          </div>
        </div>
      </div>

      <!-- Stock -->
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <h2 class="mb-4 text-sm font-semibold text-gray-700">Inventario</h2>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="mb-1 block text-sm text-gray-600">Stock actual</label>
            <input
              v-model.number="form.stock"
              type="number"
              min="0"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600">
              Mínimo (amarillo)
            </label>
            <input
              v-model.number="form.stockMin"
              type="number"
              min="0"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600">
              Crítico (rojo)
            </label>
            <input
              v-model.number="form.stockCritical"
              type="number"
              min="0"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      <!-- Variants toggle -->
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-semibold text-gray-700">Variantes</h2>
            <p class="text-xs text-gray-500">
              Talla, color, referencia, modelo
            </p>
          </div>
          <label class="relative inline-flex cursor-pointer items-center">
            <input
              v-model="form.hasVariants"
              type="checkbox"
              class="peer sr-only"
            />
            <div
              class="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-nova-primary peer-checked:after:translate-x-full"
            />
          </label>
        </div>

        <!-- Variant management (shown when hasVariants is true) -->
        <div v-if="form.hasVariants" class="mt-4 space-y-4">
          <!-- Attribute keys -->
          <div>
            <label class="mb-1 block text-xs text-gray-500">
              Atributos de variante
            </label>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="key in variantAttributeKeys"
                :key="key"
                class="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700"
              >
                {{ key }}
                <button
                  type="button"
                  class="text-blue-400 hover:text-blue-600"
                  @click="removeAttributeKey(key)"
                >
                  x
                </button>
              </span>
              <div class="flex gap-1">
                <input
                  v-model="newAttributeKey"
                  type="text"
                  placeholder="Ej: Talla"
                  class="w-24 rounded-lg border border-gray-300 px-2 py-1 text-xs"
                  @keyup.enter="addAttributeKey"
                />
                <button
                  type="button"
                  class="rounded-lg bg-gray-100 px-2 py-1 text-xs"
                  @click="addAttributeKey"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <!-- Variant rows -->
          <div v-if="variants.length > 0" class="space-y-2">
            <div
              v-for="variant in variants"
              :key="variant.id"
              class="flex items-center gap-2 rounded-lg border border-gray-200 p-3"
            >
              <div
                v-for="key in variantAttributeKeys"
                :key="key"
                class="flex-1"
              >
                <input
                  v-model="variant.attributes[key]"
                  type="text"
                  :placeholder="key"
                  class="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                />
              </div>
              <input
                v-model.number="variant.stock"
                type="number"
                min="0"
                placeholder="Stock"
                class="w-16 rounded border border-gray-200 px-2 py-1 text-xs"
              />
              <input
                v-model.number="variant.price"
                type="number"
                step="0.01"
                min="0"
                placeholder="Precio"
                class="w-20 rounded border border-gray-200 px-2 py-1 text-xs"
              />
              <button
                type="button"
                class="text-xs text-red-400 hover:text-red-600"
                @click="removeVariant(variant.id)"
              >
                x
              </button>
            </div>
          </div>

          <button
            type="button"
            class="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-nova-primary hover:text-nova-primary"
            @click="addVariant"
          >
            + Agregar variante
          </button>
        </div>
      </div>

      <!-- Error -->
      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

      <!-- Submit -->
      <button
        type="submit"
        class="w-full rounded-xl bg-nova-primary py-3 font-medium text-white disabled:opacity-50"
        :disabled="isSubmitting"
      >
        {{
          isSubmitting
            ? "Guardando..."
            : isEditing
              ? "Guardar cambios"
              : "Crear producto"
        }}
      </button>
    </form>
  </div>
</template>
