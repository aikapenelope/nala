<script setup lang="ts">
/**
 * Photo import page - take photo of price list, OCR extracts products.
 *
 * Flow:
 * 1. Take photo or select image of a supplier's price list
 * 2. Send to POST /api/ocr/price-list (GPT-4o-mini vision)
 * 3. Review extracted products (name, price, SKU)
 * 4. Edit/remove items as needed
 * 5. Import via POST /api/products/batch
 *
 * Connected to:
 * - POST /api/ocr/price-list
 * - POST /api/products/batch
 */

import { Camera, Trash2, Check } from "lucide-vue-next";

const { $api } = useApi();

type Step = "capture" | "processing" | "review" | "importing" | "done";
const step = ref<Step>("capture");

/** Image data. */
const imageBase64 = ref("");
const processError = ref("");

/** Extracted products from OCR. */
interface ExtractedProduct {
  name: string;
  price: number;
  sku?: string;
  include: boolean;
}
const extractedProducts = ref<ExtractedProduct[]>([]);

/** Handle file selection (camera or gallery). */
function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    imageBase64.value = reader.result as string;
  };
  reader.readAsDataURL(file);
}

/** Send image to OCR endpoint. */
async function processImage() {
  if (!imageBase64.value) return;
  step.value = "processing";
  processError.value = "";

  try {
    const result = await $api<{
      products: Array<{ name: string; price: number; sku?: string }>;
      count: number;
    }>("/api/ocr/price-list", {
      method: "POST",
      body: { imageBase64: imageBase64.value },
    });

    extractedProducts.value = result.products.map((p) => ({
      ...p,
      include: true,
    }));

    step.value = "review";
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    processError.value =
      fetchError.data?.error ?? "Error procesando imagen. Intenta con otra foto.";
    step.value = "capture";
  }
}

/** Remove a product from the list. */
function removeProduct(index: number) {
  extractedProducts.value.splice(index, 1);
}

/** Count of included products. */
const includedCount = computed(
  () => extractedProducts.value.filter((p) => p.include).length,
);

/** Import results. */
const importedCount = ref(0);
const importError = ref("");

/** Import included products via batch endpoint. */
async function importProducts() {
  step.value = "importing";
  importError.value = "";

  const toImport = extractedProducts.value
    .filter((p) => p.include && p.name.trim() && p.price > 0)
    .map((p) => ({
      name: p.name.trim(),
      price: p.price,
      cost: 0,
      stock: 0,
      sku: p.sku || undefined,
    }));

  if (toImport.length === 0) {
    step.value = "done";
    return;
  }

  try {
    const result = await $api<{ count: number }>("/api/products/batch", {
      method: "POST",
      body: { products: toImport },
    });
    importedCount.value = result.count;
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    importError.value =
      fetchError.data?.error ?? "Error importando productos";
  }

  step.value = "done";
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">Importar por foto</h1>
      <NuxtLink
        to="/inventory"
        class="text-sm text-gray-500 hover:text-gray-700"
      >
        Cancelar
      </NuxtLink>
    </div>

    <!-- Step 1: Capture -->
    <div v-if="step === 'capture'" class="space-y-4">
      <div class="rounded-xl bg-white p-6 shadow-sm">
        <div class="flex flex-col items-center gap-4">
          <div class="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <Camera :size="32" class="text-gray-400" />
          </div>
          <p class="text-center text-sm text-gray-500">
            Toma foto de la lista de precios del proveedor
          </p>
          <p class="text-center text-xs text-gray-400">
            Funciona con listas impresas, escritas a mano, o capturas de pantalla
          </p>
          <label class="cursor-pointer rounded-lg bg-nova-primary px-6 py-2.5 text-sm font-medium text-white">
            Tomar foto o seleccionar
            <input
              type="file"
              accept="image/*"
              capture="environment"
              class="hidden"
              @change="handleFileSelect"
            >
          </label>
        </div>

        <div v-if="imageBase64" class="mt-4 text-center">
          <p class="text-sm font-medium text-green-600">Imagen cargada</p>
          <button
            class="mt-3 w-full rounded-lg bg-nova-primary py-3 font-medium text-white"
            @click="processImage"
          >
            Extraer productos con IA
          </button>
        </div>

        <p v-if="processError" class="mt-3 text-center text-sm text-red-500">
          {{ processError }}
        </p>
      </div>
    </div>

    <!-- Step 2: Processing -->
    <div v-else-if="step === 'processing'" class="rounded-xl bg-white p-8 text-center shadow-sm">
      <div class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-nova-primary border-t-transparent" />
      <p class="font-medium text-gray-700">Extrayendo productos con IA...</p>
      <p class="mt-1 text-xs text-gray-400">Esto puede tomar unos segundos</p>
    </div>

    <!-- Step 3: Review -->
    <div v-else-if="step === 'review'" class="space-y-4">
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <h2 class="mb-1 text-sm font-semibold text-gray-700">
          {{ extractedProducts.length }} productos encontrados
        </h2>
        <p class="text-xs text-gray-500">
          Revisa y edita antes de importar. Desmarca los que no quieras.
        </p>
      </div>

      <div class="space-y-2">
        <div
          v-for="(product, idx) in extractedProducts"
          :key="idx"
          class="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
          :class="{ 'opacity-40': !product.include }"
        >
          <input
            v-model="product.include"
            type="checkbox"
            class="h-4 w-4 rounded border-gray-300"
          >
          <div class="min-w-0 flex-1">
            <input
              v-model="product.name"
              type="text"
              class="w-full border-0 bg-transparent p-0 text-sm font-medium text-gray-900 outline-none"
              placeholder="Nombre del producto"
            >
            <div class="mt-1 flex items-center gap-2">
              <span class="text-xs text-gray-400">$</span>
              <input
                v-model.number="product.price"
                type="number"
                step="0.01"
                min="0"
                class="w-20 border-0 bg-transparent p-0 text-xs font-semibold text-gray-700 outline-none"
              >
              <span v-if="product.sku" class="text-xs text-gray-400">
                SKU: {{ product.sku }}
              </span>
            </div>
          </div>
          <button
            class="flex-shrink-0 text-gray-300 hover:text-red-500"
            @click="removeProduct(idx)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>

      <button
        class="w-full rounded-xl bg-nova-primary py-3 font-medium text-white disabled:opacity-50"
        :disabled="includedCount === 0"
        @click="importProducts"
      >
        Importar {{ includedCount }} producto{{ includedCount !== 1 ? "s" : "" }}
      </button>

      <button
        class="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600"
        @click="step = 'capture'"
      >
        Tomar otra foto
      </button>
    </div>

    <!-- Step 4: Importing -->
    <div v-else-if="step === 'importing'" class="rounded-xl bg-white p-8 text-center shadow-sm">
      <div class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-nova-primary border-t-transparent" />
      <p class="text-gray-500">Importando productos...</p>
    </div>

    <!-- Step 5: Done -->
    <div v-else class="rounded-xl bg-white p-8 shadow-sm">
      <div class="text-center">
        <div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <Check :size="24" class="text-green-600" />
        </div>
        <p class="font-semibold text-gray-900">
          {{ importedCount }} productos importados
        </p>
        <p v-if="importError" class="mt-1 text-sm text-red-500">
          {{ importError }}
        </p>
      </div>

      <div class="mt-6 flex gap-3">
        <button
          class="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600"
          @click="step = 'capture'; extractedProducts = []; imageBase64 = ''"
        >
          Importar mas
        </button>
        <NuxtLink
          to="/inventory"
          class="flex-1 rounded-xl bg-nova-primary py-2.5 text-center text-sm font-medium text-white"
        >
          Ver inventario
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
