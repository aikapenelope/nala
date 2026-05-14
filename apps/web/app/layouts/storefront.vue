<script setup lang="ts">
/**
 * Storefront layout - standalone public store experience.
 *
 * Premium glassmorphism design matching the admin dashboard.
 * No sidebar, no auth required.
 * Used by /tienda/* pages when accessed via tenant subdomain.
 *
 * Features:
 * - Glassmorphism header with backdrop blur
 * - Dark/light/system mode toggle with persistence
 * - WhatsApp contact button in header
 * - PWA install banner
 * - Responsive footer with store branding
 */

const { tenantSlug } = useTenant();
const { business } = useStorefront();
const { itemCount } = useCart();
const { showBanner, canInstall, isIos, install, dismiss } = usePwaInstall();
const { mode, toggle, init } = useColorMode();

/** Display name: business name when loaded, generic fallback otherwise. */
const storeName = computed(() => business.value?.name ?? "Tienda");

/** WhatsApp link for the business. */
const whatsappLink = computed(() => {
  const phone = business.value?.whatsappNumber;
  if (!phone) return null;
  const clean = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${clean}`;
});

/** Mode icon label for accessibility. */
const modeLabel = computed(() => {
  if (mode.value === "dark") return "Modo oscuro";
  if (mode.value === "light") return "Modo claro";
  return "Modo automatico";
});

/** Handle the install button click. */
async function handleInstall() {
  if (canInstall.value) {
    await install();
  }
}

onMounted(() => {
  init();
});
</script>

<template>
  <div
    class="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 transition-colors duration-300 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950"
  >
    <!-- Header -->
    <header
      class="sticky top-0 z-40 border-b border-white/60 bg-white/70 backdrop-blur-xl dark:border-gray-800/60 dark:bg-gray-900/70"
    >
      <div class="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <!-- Store name -->
        <NuxtLink
          to="/tienda"
          class="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white"
        >
          {{ storeName }}
        </NuxtLink>

        <!-- Right actions -->
        <div class="flex items-center gap-2">
          <!-- WhatsApp contact -->
          <a
            v-if="whatsappLink"
            :href="whatsappLink"
            target="_blank"
            rel="noopener noreferrer"
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500/10 text-green-600 transition-all hover:bg-green-500/20 dark:bg-green-500/15 dark:text-green-400"
            aria-label="Contactar por WhatsApp"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </a>

          <!-- Color mode toggle -->
          <button
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100/80 text-gray-500 transition-all hover:bg-gray-200/80 dark:bg-gray-800/80 dark:text-gray-400 dark:hover:bg-gray-700/80"
            :aria-label="modeLabel"
            :title="modeLabel"
            @click="toggle"
          >
            <!-- Sun (light mode) -->
            <svg
              v-if="mode === 'light'"
              xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
            </svg>
            <!-- Moon (dark mode) -->
            <svg
              v-else-if="mode === 'dark'"
              xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            >
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
            <!-- Monitor (system mode) -->
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            >
              <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
            </svg>
          </button>

          <!-- Cart -->
          <NuxtLink
            to="/tienda/cart"
            class="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100/80 text-gray-600 transition-all hover:bg-gray-200/80 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:bg-gray-700/80"
            aria-label="Ver carrito"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            >
              <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </svg>
            <span
              v-if="itemCount > 0"
              class="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-bold leading-none text-white dark:bg-white dark:text-gray-900"
            >
              {{ itemCount > 99 ? "99+" : itemCount }}
            </span>
          </NuxtLink>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="mx-auto max-w-3xl px-4 py-6">
      <slot />
    </main>

    <!-- PWA install banner -->
    <div
      v-if="showBanner"
      class="border-t border-gray-200/60 bg-white/80 backdrop-blur-md dark:border-gray-800/60 dark:bg-gray-900/80"
    >
      <div class="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-900 dark:bg-white">
          <svg
            xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" class="stroke-white dark:stroke-gray-900" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          >
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" />
          </svg>
        </div>

        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">
            Instala esta tienda
          </p>
          <p v-if="isIos" class="text-xs text-gray-500 dark:text-gray-400">
            Toca
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline align-text-bottom">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" x2="12" y1="2" y2="15" />
            </svg>
            y luego "Agregar a inicio"
          </p>
          <p v-else class="text-xs text-gray-500 dark:text-gray-400">
            Accede rapido desde tu celular
          </p>
        </div>

        <button
          v-if="canInstall"
          class="flex-shrink-0 rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          @click="handleInstall"
        >
          Instalar
        </button>
        <button
          class="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
    <footer class="border-t border-gray-200/60 bg-white/60 py-6 backdrop-blur-sm dark:border-gray-800/60 dark:bg-gray-900/60">
      <div class="mx-auto max-w-3xl px-4 text-center text-xs text-gray-400 dark:text-gray-500">
        <p>Tienda en linea · Precios en USD</p>
        <p v-if="tenantSlug" class="mt-1">
          Powered by
          <a
            href="https://novaincs.com"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Nova
          </a>
        </p>
      </div>
    </footer>
  </div>
</template>
