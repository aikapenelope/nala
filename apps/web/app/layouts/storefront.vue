<script setup lang="ts">
/**
 * Storefront layout - standalone public store experience.
 *
 * No sidebar, no header, no auth required.
 * Used by /tienda/* pages when accessed via tenant subdomain.
 * Clean, minimal design focused on the shopping experience.
 *
 * Reads business name from useStorefront() and cart count from useCart()
 * directly — no slots needed from child pages.
 */

const { tenantSlug } = useTenant();
const { business } = useStorefront();
const { itemCount } = useCart();
const { showBanner, canInstall, isIos, install, dismiss } = usePwaInstall();

/** Display name: business name when loaded, generic fallback otherwise. */
const storeName = computed(() => business.value?.name ?? "Tienda");

/** Handle the install button click. */
async function handleInstall() {
  if (canInstall.value) {
    await install();
  }
  // On iOS the banner shows instructions, no programmatic install
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Minimal header with store branding -->
    <header class="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <NuxtLink to="/tienda" class="text-lg font-bold text-gray-900">
          {{ storeName }}
        </NuxtLink>
        <NuxtLink
          to="/tienda/cart"
          class="relative flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200"
          aria-label="Ver carrito"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-gray-700"
          >
            <circle cx="8" cy="21" r="1" />
            <circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
          </svg>
          <!-- Cart item count badge -->
          <span
            v-if="itemCount > 0"
            class="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-bold leading-none text-white"
          >
            {{ itemCount > 99 ? "99+" : itemCount }}
          </span>
        </NuxtLink>
      </div>
    </header>

    <!-- Main content -->
    <main class="mx-auto max-w-3xl px-4 py-6">
      <slot />
    </main>

    <!-- PWA install banner -->
    <div
      v-if="showBanner"
      class="border-t border-gray-100 bg-white"
    >
      <div class="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <!-- Phone icon -->
        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-900">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
            <path d="M12 18h.01" />
          </svg>
        </div>

        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900">
            Instala esta tienda
          </p>
          <p v-if="isIos" class="text-xs text-gray-500">
            Toca
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline align-text-bottom">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" x2="12" y1="2" y2="15" />
            </svg>
            y luego "Agregar a inicio"
          </p>
          <p v-else class="text-xs text-gray-500">
            Accede rapido desde tu celular
          </p>
        </div>

        <!-- Install / dismiss buttons -->
        <button
          v-if="canInstall"
          class="flex-shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white"
          @click="handleInstall"
        >
          Instalar
        </button>
        <button
          class="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600"
          aria-label="Cerrar"
          @click="dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Footer -->
    <footer class="border-t border-gray-100 bg-white py-6">
      <div class="mx-auto max-w-3xl px-4 text-center text-xs text-gray-400">
        <p>Tienda en linea · Precios en USD</p>
        <p v-if="tenantSlug" class="mt-1">
          Powered by
          <a
            href="https://novaincs.com"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-gray-500 hover:text-gray-700"
          >
            Nova
          </a>
        </p>
      </div>
    </footer>
  </div>
</template>
