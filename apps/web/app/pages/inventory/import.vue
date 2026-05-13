<script setup lang="ts">
/**
 * Excel/CSV import page for bulk product upload.
 *
 * Works on both desktop and mobile.
 * Flow:
 * 1. Upload file (CSV, XLSX)
 * 2. Auto-detect columns by header name
 * 3. Preview first 5 rows + duplicate detection by SKU
 * 4. Validate (missing prices, duplicates, existing SKUs)
 * 5. Import (skip duplicates or update them)
 */

import * as XLSX from "xlsx";
import { AlertTriangle } from "lucide-vue-next";

const { $api } = useApi();

/** Import steps. */
type ImportStep = "upload" | "preview" | "importing" | "done";
const step = ref<ImportStep>("upload");

/** Parsed rows from the file. */
const rows = ref<Array<Record<string, string>>>([]);
const headers = ref<string[]>([]);
const fileName = ref("");

/** Column mapping: which file column maps to which Nova field. */
const columnMap = ref<Record<string, string>>({
  name: "",
  sku: "",
  price: "",
  cost: "",
  stock: "",
  category: "",
  barcode: "",
});

/** Nova fields that can be mapped. */
const novaFields = [
  { key: "name", label: "Nombre *", required: true },
  { key: "sku", label: "SKU", required: false },
  { key: "price", label: "Precio venta *", required: true },
  { key: "cost", label: "Costo", required: false },
  { key: "stock", label: "Stock", required: false },
  { key: "category", label: "Categoria", required: false },
  { key: "barcode", label: "Codigo de barras", required: false },
];

/** Existing SKUs in the database (for duplicate detection). */
const existingSkus = ref<Set<string>>(new Set());
const duplicateSkus = ref<Set<string>>(new Set());
const skipDuplicates = ref(true);

/** Auto-detect column mapping by header name similarity. */
function autoDetectColumns() {
  const lowerHeaders = headers.value.map((h) => h.toLowerCase().trim());

  const patterns: Record<string, string[]> = {
    name: ["nombre", "producto", "descripcion", "name", "product"],
    sku: ["sku", "codigo", "code", "referencia", "ref"],
    price: ["precio", "price", "pvp", "precio venta"],
    cost: ["costo", "cost", "precio compra"],
    stock: ["stock", "cantidad", "qty", "existencia", "inventario"],
    category: ["categoria", "category", "tipo", "rubro"],
    barcode: ["barcode", "ean", "upc", "codigo barras"],
  };

  for (const [field, keywords] of Object.entries(patterns)) {
    const match = lowerHeaders.findIndex((h) =>
      keywords.some((k) => h.includes(k)),
    );
    if (match >= 0 && headers.value[match]) {
      (columnMap.value as Record<string, string>)[field] = headers.value[match];
    }
  }
}

/** Fetch existing SKUs from the database for duplicate detection. */
async function fetchExistingSkus() {
  try {
    const result = await $api<{
      products: Array<{ sku: string | null }>;
    }>("/api/products?limit=5000&fields=sku");
    existingSkus.value = new Set(
      result.products
        .map((p) => p.sku)
        .filter((s): s is string => !!s)
        .map((s) => s.toLowerCase()),
    );
  } catch {
    // Non-critical: duplicate detection won't work but import still can
  }
}

/** Detect duplicates in the uploaded file against existing products. */
function detectDuplicates() {
  duplicateSkus.value = new Set();
  if (!columnMap.value.sku) return;

  for (const row of rows.value) {
    const sku = row[columnMap.value.sku]?.trim().toLowerCase();
    if (sku && existingSkus.value.has(sku)) {
      duplicateSkus.value.add(sku);
    }
  }
}

/** Handle file upload. */
async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  fileName.value = file.name;

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return;
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return;
  const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
  });

  if (json.length === 0) return;

  const firstRow = json[0];
  if (!firstRow) return;
  headers.value = Object.keys(firstRow);
  rows.value = json;

  autoDetectColumns();
  await fetchExistingSkus();
  detectDuplicates();
  step.value = "preview";
}

// Re-detect duplicates when SKU column mapping changes
watch(() => columnMap.value.sku, detectDuplicates);

/** Validation errors for preview. */
const validationErrors = computed(() => {
  const errors: string[] = [];
  if (!columnMap.value.name) errors.push("Columna 'Nombre' no mapeada");
  if (!columnMap.value.price) errors.push("Columna 'Precio' no mapeada");
  return errors;
});

/** Preview rows (first 5). */
const previewRows = computed(() => rows.value.slice(0, 5));

/** Count of products that will be imported (excluding duplicates if skipping). */
const importableCount = computed(() => {
  if (!skipDuplicates.value || duplicateSkus.value.size === 0) {
    return rows.value.length;
  }
  const skuCol = columnMap.value.sku;
  if (!skuCol) return rows.value.length;
  return rows.value.filter((row) => {
    const sku = row[skuCol]?.trim().toLowerCase();
    return !sku || !duplicateSkus.value.has(sku);
  }).length;
});

/** Import progress tracking. */
const importedCount = ref(0);
const importErrors = ref<Array<{ row: number; name: string; error: string }>>(
  [],
);

/**
 * Import products using the batch endpoint POST /api/products/batch.
 * Validates rows client-side first, then sends all valid products
 * in a single atomic transaction. Skips duplicates if option is set.
 */
async function startImport() {
  step.value = "importing";
  importedCount.value = 0;
  importErrors.value = [];

  const map = columnMap.value;

  // Validate and map all rows
  const validProducts: Array<{
    name: string;
    sku?: string;
    barcode?: string;
    price: number;
    cost: number;
    stock: number;
  }> = [];

  for (let i = 0; i < rows.value.length; i++) {
    const row = rows.value[i];
    if (!row) continue;

    const nameVal = map.name ? row[map.name]?.trim() : "";
    const priceVal = map.price ? Number(row[map.price]) : 0;
    const skuVal = map.sku ? row[map.sku]?.trim() : "";

    // Skip duplicates if option is set
    if (
      skipDuplicates.value &&
      skuVal &&
      duplicateSkus.value.has(skuVal.toLowerCase())
    ) {
      importErrors.value.push({
        row: i + 2,
        name: nameVal || "(sin nombre)",
        error: `SKU duplicado: ${skuVal} (ya existe)`,
      });
      continue;
    }

    if (!nameVal || isNaN(priceVal) || priceVal <= 0) {
      importErrors.value.push({
        row: i + 2,
        name: nameVal || "(sin nombre)",
        error: !nameVal ? "Nombre vacio" : "Precio invalido",
      });
      continue;
    }

    validProducts.push({
      name: nameVal,
      sku: skuVal || undefined,
      barcode: map.barcode ? row[map.barcode]?.trim() || undefined : undefined,
      price: priceVal,
      cost: map.cost ? Number(row[map.cost]) || 0 : 0,
      stock: map.stock ? Math.floor(Number(row[map.stock]) || 0) : 0,
    });
  }

  if (validProducts.length === 0) {
    step.value = "done";
    return;
  }

  // Send all valid products in a single batch request
  try {
    const result = await $api<{ count: number }>("/api/products/batch", {
      method: "POST",
      body: { products: validProducts },
    });
    importedCount.value = result.count;
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    importErrors.value.push({
      row: 0,
      name: "Batch",
      error: fetchError.data?.error ?? "Error importando productos",
    });
  }

  step.value = "done";
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">Importar productos</h1>
      <NuxtLink
        to="/inventory"
        class="text-sm text-gray-500 hover:text-gray-700"
      >
        Cancelar
      </NuxtLink>
    </div>

    <!-- Step 1: Upload -->
    <div v-if="step === 'upload'" class="rounded-xl bg-white p-8 shadow-sm">
      <div class="text-center">
        <p class="mb-4 text-gray-500">
          Sube un archivo Excel (.xlsx) o CSV con tus productos
        </p>
        <label
          class="inline-block cursor-pointer rounded-xl bg-nova-primary px-6 py-3 font-medium text-white"
        >
          Seleccionar archivo
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            class="hidden"
            @change="handleFileUpload"
          >
        </label>
        <p class="mt-3 text-xs text-gray-400">
          Funciona en celular y computadora
        </p>
      </div>
    </div>

    <!-- Step 2: Preview and mapping -->
    <div v-else-if="step === 'preview'" class="space-y-4">
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <h2 class="mb-1 text-sm font-semibold text-gray-700">
          {{ fileName }} - {{ rows.length }} productos encontrados
        </h2>

        <!-- Column mapping -->
        <div class="mt-4 grid grid-cols-2 gap-3">
          <div v-for="field in novaFields" :key="field.key">
            <label class="mb-1 block text-xs text-gray-500">
              {{ field.label }}
            </label>
            <select
              v-model="columnMap[field.key]"
              class="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">-- No mapear --</option>
              <option v-for="h in headers" :key="h" :value="h">
                {{ h }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- Duplicate detection warning -->
      <div
        v-if="duplicateSkus.size > 0"
        class="rounded-xl border border-amber-200 bg-amber-50 p-4"
      >
        <div class="flex items-start gap-3">
          <AlertTriangle :size="18" class="mt-0.5 flex-shrink-0 text-amber-600" />
          <div>
            <p class="text-sm font-semibold text-amber-800">
              {{ duplicateSkus.size }} producto{{ duplicateSkus.size > 1 ? "s" : "" }} con SKU duplicado
            </p>
            <p class="mt-0.5 text-xs text-amber-700">
              Estos SKUs ya existen en tu inventario:
              {{ [...duplicateSkus].slice(0, 5).join(", ") }}{{ duplicateSkus.size > 5 ? "..." : "" }}
            </p>
            <div class="mt-2 flex items-center gap-3">
              <label class="flex items-center gap-2 text-xs font-medium text-amber-800">
                <input
                  v-model="skipDuplicates"
                  type="checkbox"
                  class="h-3.5 w-3.5 rounded border-amber-300"
                >
                Omitir duplicados (importar solo los nuevos)
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Preview table -->
      <div class="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table class="w-full text-left text-xs">
          <thead class="border-b bg-gray-50">
            <tr>
              <th
                v-for="h in headers"
                :key="h"
                class="px-3 py-2 font-medium text-gray-500"
              >
                {{ h }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="(row, idx) in previewRows" :key="idx">
              <td
                v-for="h in headers"
                :key="h"
                class="px-3 py-2 text-gray-700"
              >
                {{ row[h] }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="rows.length > 5" class="px-3 py-2 text-xs text-gray-400">
          Mostrando 5 de {{ rows.length }} filas
        </p>
      </div>

      <!-- Validation errors -->
      <div
        v-if="validationErrors.length > 0"
        class="rounded-xl bg-red-50 p-4"
      >
        <p
          v-for="err in validationErrors"
          :key="err"
          class="text-sm text-red-600"
        >
          {{ err }}
        </p>
      </div>

      <!-- Import button -->
      <button
        class="w-full rounded-xl bg-nova-primary py-3 font-medium text-white disabled:opacity-50"
        :disabled="validationErrors.length > 0 || importableCount === 0"
        @click="startImport"
      >
        Importar {{ importableCount }} producto{{ importableCount !== 1 ? "s" : "" }}
        <span v-if="duplicateSkus.size > 0 && skipDuplicates" class="text-white/70">
          ({{ duplicateSkus.size }} omitido{{ duplicateSkus.size > 1 ? "s" : "" }})
        </span>
      </button>
    </div>

    <!-- Step 3: Importing -->
    <div
      v-else-if="step === 'importing'"
      class="rounded-xl bg-white p-8 text-center shadow-sm"
    >
      <div
        class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-nova-primary border-t-transparent"
      />
      <p class="text-gray-500">
        Importando productos... {{ importedCount }}/{{ importableCount }}
      </p>
      <div
        class="mx-auto mt-3 h-2 w-48 overflow-hidden rounded-full bg-gray-100"
      >
        <div
          class="h-full rounded-full bg-nova-primary transition-all"
          :style="{
            width: `${(importedCount / Math.max(importableCount, 1)) * 100}%`,
          }"
        />
      </div>
    </div>

    <!-- Step 4: Done -->
    <div v-else class="rounded-xl bg-white p-8 shadow-sm">
      <div class="text-center">
        <p class="text-2xl">✓</p>
        <p class="mt-2 font-semibold text-gray-900">
          {{ importedCount }} productos importados
        </p>
        <p v-if="importErrors.length > 0" class="mt-1 text-sm text-amber-600">
          {{ importErrors.length }} omitido{{ importErrors.length > 1 ? "s" : "" }}
        </p>
      </div>

      <!-- Error details -->
      <div
        v-if="importErrors.length > 0"
        class="mt-4 max-h-40 overflow-y-auto rounded-lg bg-amber-50 p-3"
      >
        <p class="mb-2 text-xs font-medium text-amber-700">
          Filas omitidas:
        </p>
        <div
          v-for="err in importErrors"
          :key="err.row"
          class="text-xs text-amber-600"
        >
          Fila {{ err.row }}: {{ err.name }} - {{ err.error }}
        </div>
      </div>

      <NuxtLink
        to="/inventory"
        class="mt-6 block rounded-xl bg-nova-primary py-2 text-center text-sm font-medium text-white"
      >
        Ver inventario
      </NuxtLink>
    </div>
  </div>
</template>
