<script setup lang="ts">
/**
 * Product creation/edit form.
 *
 * Connected to:
 * - GET /api/products/:id (load existing product for editing)
 * - POST /api/products (create new product)
 * - PATCH /api/products/:id (update existing product)
 * - POST /api/products/:id/variants (add variant)
 * - GET /api/categories (load category options)
 */

definePageMeta({ middleware: ["admin-only"] });

const route = useRoute();
const router = useRouter();
const { $api } = useApi();

const productId = computed(() => {
  const id = route.params.id as string;
  return id === "new" ? null : id;
});
const isEditing = computed(() => productId.value !== null);

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
  isService: false,
  wholesalePrice: 0,
  wholesaleMinQty: 1,
  brand: "",
  location: "",
  expiresAt: "",
});

/** Categories from API. */
const categories = ref<Array<{ id: string; name: string }>>([]);

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
const isLoadingProduct = ref(false);
const error = ref("");

/** Load categories and existing product data. */
onMounted(async () => {
  // Load categories
  try {
    const result = await $api<{
      categories: Array<{ id: string; name: string }>;
    }>("/api/categories");
    categories.value = result.categories;
  } catch {
    // Non-critical: category dropdown will be empty
  }

  // Load existing product for editing
  if (productId.value) {
    isLoadingProduct.value = true;
    try {
      const result = await $api<{
        product: {
          name: string;
          description: string | null;
          categoryId: string | null;
          sku: string | null;
          barcode: string | null;
          cost: string;
          price: string;
          stock: number;
          stockMin: number;
          stockCritical: number;
          hasVariants: boolean;
          isService: boolean;
          wholesalePrice: string | null;
          wholesaleMinQty: number;
          brand: string | null;
          location: string | null;
          expiresAt: string | null;
        };
        variants: Array<{
          id: string;
          attributes: Record<string, string>;
          sku: string | null;
          cost: string;
          price: string;
          stock: number;
        }>;
      }>(`/api/products/${productId.value}`);

      const p = result.product;
      form.name = p.name;
      form.description = p.description ?? "";
      form.categoryId = p.categoryId ?? "";
      form.sku = p.sku ?? "";
      form.barcode = p.barcode ?? "";
      form.cost = Number(p.cost);
      form.price = Number(p.price);
      form.stock = p.stock;
      form.stockMin = p.stockMin;
      form.stockCritical = p.stockCritical;
      form.hasVariants = p.hasVariants;
      form.isService = p.isService;
      form.wholesalePrice = Number(p.wholesalePrice ?? 0);
      form.wholesaleMinQty = p.wholesaleMinQty;
      form.brand = p.brand ?? "";
      form.location = p.location ?? "";
      form.expiresAt = p.expiresAt ? (p.expiresAt.split("T")[0] ?? "") : "";

      if (result.variants.length > 0) {
        variants.value = result.variants.map((v) => ({
          id: v.id,
          attributes: v.attributes as Record<string, string>,
          sku: v.sku ?? "",
          cost: Number(v.cost),
          price: Number(v.price),
          stock: v.stock,
        }));

        // Extract attribute keys from first variant
        const firstVariant = result.variants[0];
        if (firstVariant?.attributes) {
          variantAttributeKeys.value = Object.keys(
            firstVariant.attributes as Record<string, string>,
          );
        }
      }
    } catch {
      error.value = "Error cargando producto";
    } finally {
      isLoadingProduct.value = false;
    }
  }
});

async function submitForm() {
  if (!form.name.trim() || form.price <= 0) {
    error.value = "Nombre y precio son obligatorios";
    return;
  }

  isSubmitting.value = true;
  error.value = "";

  try {
    const body = {
      name: form.name.trim(),
      description: form.description || undefined,
      categoryId: form.categoryId || undefined,
      sku: form.sku || undefined,
      barcode: form.barcode || undefined,
      cost: form.cost,
      price: form.price,
      stock: form.stock,
      stockMin: form.stockMin,
      stockCritical: form.stockCritical,
      hasVariants: form.hasVariants,
      isService: form.isService,
      wholesalePrice: form.wholesalePrice > 0 ? form.wholesalePrice : undefined,
      wholesaleMinQty: form.wholesaleMinQty,
      brand: form.brand || undefined,
      location: form.location || undefined,
      expiresAt: form.expiresAt
        ? new Date(form.expiresAt).toISOString()
        : undefined,
    };

    if (isEditing.value) {
      await $api(`/api/products/${productId.value}`, {
        method: "PATCH",
        body,
      });
    } else {
      const result = await $api<{ product: { id: string } }>("/api/products", {
        method: "POST",
        body,
      });

      // Create variants for new product
      if (form.hasVariants && variants.value.length > 0) {
        for (const v of variants.value) {
          await $api(`/api/products/${result.product.id}/variants`, {
            method: "POST",
            body: {
              attributes: v.attributes,
              sku: v.sku || undefined,
              cost: v.cost,
              price: v.price,
              stock: v.stock,
            },
          });
        }
      }
    }

    router.push("/inventory");
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    error.value = fetchError.data?.error ?? "Error al guardar el producto";
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

    <!-- Loading existing product -->
    <div v-if="isLoadingProduct" class="py-12 text-center text-gray-400">
      Cargando producto...
    </div>

    <form v-else class="space-y-6" @submit.prevent="submitForm">
      <!-- Basic info -->
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <h2 class="mb-4 text-sm font-semibold text-gray-700">
          Informacion basica
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
            >
          </div>

          <div>
            <label class="mb-1 block text-sm text-gray-600">Descripcion</label>
            <textarea
              v-model="form.description"
              rows="2"
              placeholder="Descripcion opcional"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            />
          </div>

          <div>
            <label class="mb-1 block text-sm text-gray-600">Categoria</label>
            <select
              v-model="form.categoryId"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            >
              <option value="">Sin categoria</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-1 block text-sm text-gray-600">SKU</label>
              <input
                v-model="form.sku"
                type="text"
                placeholder="HP-001"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              >
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600">
                Codigo de barras
              </label>
              <input
                v-model="form.barcode"
                type="text"
                placeholder="7591234567890"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Product type and details -->
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <h2 class="mb-4 text-sm font-semibold text-gray-700">
          Tipo y detalles
        </h2>

        <div class="space-y-4">
          <!-- Service toggle -->
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-700">
                Producto tipo servicio
              </p>
              <p class="text-xs text-gray-500">
                No maneja inventario (peluqueria, taller, etc.)
              </p>
            </div>
            <label class="relative inline-flex cursor-pointer items-center">
              <input
                v-model="form.isService"
                type="checkbox"
                class="peer sr-only"
              >
              <div
                class="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-nova-primary peer-checked:after:translate-x-full"
              />
            </label>
          </div>

          <!-- Brand and location -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-1 block text-sm text-gray-600">Marca</label>
              <input
                v-model="form.brand"
                type="text"
                placeholder="Ej: Samsung"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              >
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600">
                Ubicacion fisica
              </label>
              <input
                v-model="form.location"
                type="text"
                placeholder="Ej: Estante A3"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              >
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
            >
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
            >
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

        <!-- Wholesale pricing -->
        <div class="mt-4 border-t border-gray-100 pt-4">
          <p class="mb-3 text-xs font-medium text-gray-500">
            Precio al mayor (opcional)
          </p>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-1 block text-sm text-gray-600">
                Precio al mayor
              </label>
              <input
                v-model.number="form.wholesalePrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              >
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600">
                Cantidad minima
              </label>
              <input
                v-model.number="form.wholesaleMinQty"
                type="number"
                min="1"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Stock (hidden for services) -->
      <div v-if="!form.isService" class="rounded-xl bg-white p-5 shadow-sm">
        <h2 class="mb-4 text-sm font-semibold text-gray-700">Inventario</h2>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="mb-1 block text-sm text-gray-600">Stock actual</label>
            <input
              v-model.number="form.stock"
              type="number"
              min="0"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            >
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600">
              Minimo (amarillo)
            </label>
            <input
              v-model.number="form.stockMin"
              type="number"
              min="0"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            >
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600">
              Critico (rojo)
            </label>
            <input
              v-model.number="form.stockCritical"
              type="number"
              min="0"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            >
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
            >
            <div
              class="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-nova-primary peer-checked:after:translate-x-full"
            />
          </label>
        </div>

        <!-- Variant management -->
        <div v-if="form.hasVariants" class="mt-4 space-y-4">
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
                >
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
                >
              </div>
              <input
                v-model.number="variant.stock"
                type="number"
                min="0"
                placeholder="Stock"
                class="w-16 rounded border border-gray-200 px-2 py-1 text-xs"
              >
              <input
                v-model.number="variant.price"
                type="number"
                step="0.01"
                min="0"
                placeholder="Precio"
                class="w-20 rounded border border-gray-200 px-2 py-1 text-xs"
              >
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
