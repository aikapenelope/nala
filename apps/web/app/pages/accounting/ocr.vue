<script setup lang="ts">
/**
 * OCR invoice scanner - take photo, extract items, confirm.
 *
 * Connected to:
 * - POST /api/ocr/invoice (send image, get extracted items)
 * - POST /api/ocr/confirm (confirm items, create expense + update stock)
 */

import { ArrowLeft, Camera, Check } from "lucide-vue-next";

definePageMeta({ middleware: ["admin-only"] });

const router = useRouter();
const { $api } = useApi();

/** Step 1: Capture image. */
const imageBase64 = ref("");
const isProcessing = ref(false);
const processError = ref("");

/** Step 2: Review extracted items. */
interface ExtractedItem {
  description: string;
  quantity: number;
  unitCost: number;
  total: number;
  matchedProductId: string | null;
  matchedProductName: string | null;
  matchConfidence: string;
}

const extractedItems = ref<ExtractedItem[]>([]);
const supplierName = ref("");
const invoiceNumber = ref("");
const invoiceTotal = ref(0);
const showReview = ref(false);

/** Step 3: Confirm. */
const isConfirming = ref(false);
const confirmError = ref("");

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    // Remove data:image/...;base64, prefix
    imageBase64.value = result.includes(",") ? result.split(",")[1] ?? "" : result;
  };
  reader.readAsDataURL(file);
}

async function processImage() {
  if (!imageBase64.value) return;
  isProcessing.value = true;
  processError.value = "";
  try {
    const result = await $api<{
      supplier: string;
      invoiceNumber: string;
      total: number;
      items: ExtractedItem[];
    }>("/api/ocr/invoice", {
      method: "POST",
      body: { imageBase64: imageBase64.value },
    });
    extractedItems.value = result.items;
    supplierName.value = result.supplier;
    invoiceNumber.value = result.invoiceNumber;
    invoiceTotal.value = result.total;
    showReview.value = true;
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    processError.value = fetchError.data?.error ?? "Error procesando imagen";
  } finally {
    isProcessing.value = false;
  }
}

async function confirmItems() {
  isConfirming.value = true;
  confirmError.value = "";
  try {
    await $api("/api/ocr/confirm", {
      method: "POST",
      body: {
        supplierName: supplierName.value,
        invoiceNumber: invoiceNumber.value,
        total: invoiceTotal.value,
        items: extractedItems.value,
      },
    });
    router.push("/accounting");
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    confirmError.value = fetchError.data?.error ?? "Error confirmando factura";
  } finally {
    isConfirming.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-6">
      <NuxtLink
        to="/accounting"
        class="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft :size="16" />
        Contabilidad
      </NuxtLink>
      <h1 class="text-xl font-bold text-gray-900">Escanear factura</h1>
      <p class="text-sm text-gray-500">
        Toma foto de una factura y Nova la registra automaticamente
      </p>
    </div>

    <!-- Step 1: Capture -->
    <div v-if="!showReview" class="space-y-4">
      <div class="rounded-xl bg-white p-6 shadow-sm">
        <div class="flex flex-col items-center gap-4">
          <div class="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <Camera :size="32" class="text-gray-400" />
          </div>
          <p class="text-center text-sm text-gray-500">
            Sube una foto de la factura del proveedor
          </p>
          <label class="cursor-pointer rounded-lg bg-nova-primary px-6 py-2.5 text-sm font-medium text-white">
            Seleccionar imagen
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
            class="mt-3 w-full rounded-lg bg-nova-primary py-3 font-medium text-white disabled:opacity-50"
            :disabled="isProcessing"
            @click="processImage"
          >
            {{ isProcessing ? "Procesando con IA..." : "Procesar factura" }}
          </button>
        </div>

        <p v-if="processError" class="mt-3 text-center text-sm text-red-500">
          {{ processError }}
        </p>
      </div>
    </div>

    <!-- Step 2: Review -->
    <div v-else class="space-y-4">
      <div class="rounded-xl bg-white p-5 shadow-sm">
        <h2 class="mb-3 text-sm font-semibold text-gray-700">
          Datos extraidos
        </h2>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs text-gray-500">Proveedor</label>
            <input
              v-model="supplierName"
              type="text"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            >
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">Factura #</label>
            <input
              v-model="invoiceNumber"
              type="text"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-nova-primary focus:outline-none"
            >
          </div>
        </div>
      </div>

      <div class="rounded-xl bg-white p-5 shadow-sm">
        <h2 class="mb-3 text-sm font-semibold text-gray-700">
          Items ({{ extractedItems.length }})
        </h2>
        <div class="space-y-2">
          <div
            v-for="(item, idx) in extractedItems"
            :key="idx"
            class="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm"
          >
            <div class="flex-1">
              <p class="font-medium text-gray-900">{{ item.description }}</p>
              <p class="text-xs text-gray-500">
                {{ item.quantity }} x ${{ item.unitCost.toFixed(2) }}
                <span
                  v-if="item.matchedProductName"
                  class="ml-1 text-green-600"
                >
                  → {{ item.matchedProductName }}
                </span>
              </p>
            </div>
            <p class="font-medium text-gray-900">
              ${{ item.total.toFixed(2) }}
            </p>
          </div>
        </div>
        <div class="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
          <span class="text-sm font-semibold text-gray-700">Total</span>
          <span class="text-lg font-bold text-gray-900">
            ${{ invoiceTotal.toFixed(2) }}
          </span>
        </div>
      </div>

      <p v-if="confirmError" class="text-sm text-red-500">
        {{ confirmError }}
      </p>

      <div class="flex gap-3">
        <button
          class="flex-1 rounded-lg border border-gray-300 py-3 text-sm font-medium text-gray-700"
          @click="showReview = false"
        >
          Volver
        </button>
        <button
          class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-3 text-sm font-medium text-white disabled:opacity-50"
          :disabled="isConfirming"
          @click="confirmItems"
        >
          <Check :size="16" />
          {{ isConfirming ? "Confirmando..." : "Confirmar y registrar" }}
        </button>
      </div>
    </div>
  </div>
</template>
