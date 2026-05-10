<script setup lang="ts">
/**
 * Order confirmation page with payment proof upload.
 *
 * Shown after a successful checkout. Displays the order ID,
 * a success message, upload for payment proof, and WhatsApp link.
 */

definePageMeta({ layout: "storefront" });

const route = useRoute();
const config = useRuntimeConfig();
const apiBase = config.public.apiBase as string;
const { tenantSlug } = useTenant();
const orderId = route.params.id as string;
const { business } = useStorefront();

useStorefrontSeo({ title: "Pedido enviado" });

// Upload state
const proofFile = ref<File | null>(null);
const proofPreview = ref<string | null>(null);
const isUploading = ref(false);
const uploadSuccess = ref(false);
const uploadError = ref<string | null>(null);

/** Build WhatsApp link for follow-up. */
const whatsappLink = computed(() => {
  if (!business.value?.whatsappNumber) return null;
  const phone = business.value.whatsappNumber.replace(/[^0-9]/g, "");
  const text = encodeURIComponent(
    `Hola, hice un pedido (${orderId.slice(0, 8)}). Quiero confirmar.`,
  );
  return `https://wa.me/${phone}?text=${text}`;
});

/** Short order ID for display. */
const shortId = computed(() => orderId.slice(0, 8).toUpperCase());

/** Handle file selection. */
function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  // Validate type
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    uploadError.value = "Solo se permiten imagenes JPEG, PNG o WebP.";
    return;
  }

  // Validate size
  if (file.size > 5 * 1024 * 1024) {
    uploadError.value = "La imagen no puede superar 5MB.";
    return;
  }

  proofFile.value = file;
  uploadError.value = null;

  // Create preview
  const reader = new FileReader();
  reader.onload = (e) => {
    proofPreview.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

/** Upload the proof image. */
async function uploadProof() {
  if (!proofFile.value || isUploading.value) return;

  isUploading.value = true;
  uploadError.value = null;

  try {
    const formData = new FormData();
    formData.append("proof", proofFile.value);

    await $fetch(
      `${apiBase}/catalog/${tenantSlug.value}/orders/${orderId}/proof`,
      {
        method: "POST",
        body: formData,
      },
    );

    uploadSuccess.value = true;
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    uploadError.value =
      fetchError.data?.error ?? "Error al subir comprobante. Intenta de nuevo.";
  } finally {
    isUploading.value = false;
  }
}

/** Remove selected file. */
function removeFile() {
  proofFile.value = null;
  proofPreview.value = null;
  uploadError.value = null;
}
</script>

<template>
  <div class="py-8 text-center">
    <!-- Success icon -->
    <div
      class="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-50"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-green-500"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="m9 11 3 3L22 4" />
      </svg>
    </div>

    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Pedido enviado</h1>
    <p class="mt-2 text-sm text-gray-500">
      Tu pedido ha sido registrado exitosamente.
    </p>

    <!-- Order ID -->
    <div class="mx-auto mt-5 max-w-xs rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Numero de pedido
      </p>
      <p class="mt-1 font-mono text-lg font-bold text-gray-900 dark:text-white">
        #{{ shortId }}
      </p>
    </div>

    <!-- Payment proof upload -->
    <div class="mx-auto mt-5 max-w-xs text-left">
      <div class="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <p class="mb-3 text-sm font-semibold text-gray-800">
          Comprobante de pago (opcional)
        </p>
        <p class="mb-3 text-xs text-gray-500">
          Sube una captura de tu transferencia o pago para agilizar la confirmacion.
        </p>

        <!-- Upload success -->
        <div
          v-if="uploadSuccess"
          class="flex items-center gap-2 rounded-xl bg-green-50 p-3"
        >
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
            class="text-green-500"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="m9 11 3 3L22 4" />
          </svg>
          <span class="text-xs font-medium text-green-700">
            Comprobante enviado correctamente
          </span>
        </div>

        <!-- File input + preview -->
        <template v-else>
          <!-- Preview -->
          <div v-if="proofPreview" class="mb-3">
            <div class="relative">
              <img
                :src="proofPreview"
                alt="Preview"
                class="w-full rounded-xl object-cover"
                style="max-height: 200px"
              >
              <button
                class="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white"
                @click="removeFile"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <button
              class="mt-2 w-full rounded-xl bg-gray-900 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              :disabled="isUploading"
              @click="uploadProof"
            >
              {{ isUploading ? "Subiendo..." : "Enviar comprobante" }}
            </button>
          </div>

          <!-- File picker -->
          <label
            v-else
            class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-4 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-gray-400"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            <span class="text-xs font-medium text-gray-500">
              Toca para seleccionar imagen
            </span>
            <span class="text-[10px] text-gray-400">
              JPEG, PNG o WebP. Max 5MB.
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              @change="handleFileSelect"
            >
          </label>

          <!-- Error -->
          <p v-if="uploadError" class="mt-2 text-xs font-medium text-red-600">
            {{ uploadError }}
          </p>
        </template>
      </div>
    </div>

    <!-- Instructions -->
    <div class="mx-auto mt-5 max-w-xs space-y-3 text-left">
      <div class="flex gap-3 rounded-xl bg-blue-50 p-3">
        <span class="flex-shrink-0 text-lg">1</span>
        <p class="text-sm text-gray-700">
          Realiza el pago con el metodo que seleccionaste.
        </p>
      </div>
      <div class="flex gap-3 rounded-xl bg-blue-50 p-3">
        <span class="flex-shrink-0 text-lg">2</span>
        <p class="text-sm text-gray-700">
          Sube el comprobante arriba (opcional) o envialo por WhatsApp.
        </p>
      </div>
      <div class="flex gap-3 rounded-xl bg-blue-50 p-3">
        <span class="flex-shrink-0 text-lg">3</span>
        <p class="text-sm text-gray-700">
          El vendedor confirmara tu pago y coordinara la entrega.
        </p>
      </div>
    </div>

    <!-- WhatsApp CTA -->
    <a
      v-if="whatsappLink"
      :href="whatsappLink"
      target="_blank"
      rel="noopener noreferrer"
      class="mx-auto mt-6 flex max-w-xs items-center justify-center gap-2 rounded-xl bg-green-500 py-3.5 text-sm font-bold text-white transition-colors hover:bg-green-600"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      Contactar por WhatsApp
    </a>

    <!-- Back to store -->
    <NuxtLink
      to="/tienda"
      class="mt-4 inline-block text-sm font-medium text-gray-500 underline hover:text-gray-700"
    >
      Volver a la tienda
    </NuxtLink>
  </div>
</template>
