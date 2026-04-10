<script setup lang="ts">
/**
 * Barcode scanner component using device camera.
 *
 * Uses the BarcodeDetector API (native in Chrome/Edge) with
 * a fallback message for unsupported browsers.
 * Opens the camera, detects barcodes in real-time, and emits
 * the scanned code for product lookup.
 */

const emit = defineEmits<{
  scanned: [code: string];
  close: [];
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const isScanning = ref(false);
const error = ref("");
const lastScanned = ref("");

let stream: MediaStream | null = null;
let animationFrameId: number | null = null;

/** Check if BarcodeDetector API is available. */
const isSupported = ref(false);

onMounted(() => {
  isSupported.value = "BarcodeDetector" in window;
});

async function startScanning() {
  if (!isSupported.value) {
    error.value = "Tu navegador no soporta el escáner. Usa Chrome o Edge.";
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });

    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      await videoRef.value.play();
      isScanning.value = true;
      detectLoop();
    }
  } catch {
    error.value = "No se pudo acceder a la cámara.";
  }
}

async function detectLoop() {
  if (!videoRef.value || !isScanning.value) return;

  try {
    // @ts-expect-error -- BarcodeDetector is not yet in TypeScript lib
    const detector = new BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
    });

    const barcodes = await detector.detect(videoRef.value);

    if (barcodes.length > 0) {
      const code = barcodes[0].rawValue;
      if (code && code !== lastScanned.value) {
        lastScanned.value = code;
        emit("scanned", code);
      }
    }
  } catch {
    // Detection failed for this frame, continue
  }

  animationFrameId = requestAnimationFrame(detectLoop);
}

function stopScanning() {
  isScanning.value = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (stream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    stream = null;
  }
  emit("close");
}

onUnmounted(() => {
  stopScanning();
});
</script>

<template>
  <div class="flex flex-col items-center">
    <!-- Camera view -->
    <div
      v-if="isScanning"
      class="relative w-full max-w-sm overflow-hidden rounded-xl"
    >
      <video ref="videoRef" class="w-full" autoplay playsinline muted />
      <!-- Scan overlay -->
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="h-48 w-48 rounded-lg border-2 border-white/50" />
      </div>
      <button
        class="absolute right-2 top-2 rounded-full bg-black/50 px-3 py-1 text-sm text-white"
        @click="stopScanning"
      >
        Cerrar
      </button>
    </div>

    <!-- Start button -->
    <button
      v-else
      class="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-3 text-sm font-medium text-gray-700"
      @click="startScanning"
    >
      <span>📷</span>
      <span>Escanear código de barras</span>
    </button>

    <!-- Last scanned -->
    <p v-if="lastScanned" class="mt-2 text-xs text-gray-500">
      Último: {{ lastScanned }}
    </p>

    <!-- Error -->
    <p v-if="error" class="mt-2 text-sm text-red-500">{{ error }}</p>
  </div>
</template>
