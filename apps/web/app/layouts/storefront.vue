<script setup lang="ts">
/**
 * Storefront layout — public store experience.
 *
 * Header: business name, dark mode toggle, cart badge
 * Bottom nav: Catalogo, Info, WhatsApp (center), Carrito, Pedir
 */

import {
  LayoutGrid,
  ShoppingCart,
  Receipt,
  Store,
  Sun,
  Moon,
} from "lucide-vue-next";

const config = useRuntimeConfig();
const { tenantSlug } = useTenant();
const { business } = useStorefront();
const { itemCount } = useCart();
const { showBanner, canInstall, isIos, install, dismiss } = usePwaInstall();
const { isDark, toggle: toggleColorMode, init: initColorMode } = useColorMode();

const route = useRoute();

const storeName = computed(() => business.value?.name ?? "Tienda");

const storeUrl = computed(() => {
  if (!tenantSlug.value) return null;
  const host = (config.public.tenantDomain as string) || "novaincs.com";
  return `${tenantSlug.value}.${host}`;
});

const whatsappLink = computed(() => {
  const phone = business.value?.whatsappNumber;
  if (!phone) return null;
  return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
});

function isActive(match: string): boolean {
  if (match === "/tienda") return route.path === "/tienda";
  return route.path.startsWith(match);
}

async function handleInstall() {
  if (canInstall.value) {
    await install();
  }
}

onMounted(() => {
  initColorMode();
});
</script>

<template>
  <div class="flex min-h-screen flex-col bg-white transition-colors dark:bg-black">
    <!-- HEADER -->
    <header class="shrink-0 bg-white pt-[env(safe-area-inset-top)] z-30 dark:bg-black">
      <div class="px-5 pb-3 pt-4">
        <div class="flex items-center justify-between">
          <div class="flex flex-col">
            <NuxtLink to="/tienda" class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {{ storeName }}
            </NuxtLink>
            <p
              v-if="storeUrl"
              class="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400"
            >
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {{ storeUrl }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <!-- Dark mode toggle -->
            <button
              class="flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-600 transition-colors hover:bg-gray-100 dark:border-white/8 dark:bg-[#111] dark:text-gray-300 dark:hover:bg-white/10"
              :aria-label="isDark ? 'Modo claro' : 'Modo oscuro'"
              @click="toggleColorMode"
            >
              <Moon v-if="!isDark" :size="18" />
              <Sun v-else :size="18" />
            </button>

            <!-- Cart -->
            <NuxtLink
              to="/tienda/cart"
              class="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-gray-50 transition-colors hover:bg-gray-100 dark:border-white/8 dark:bg-[#111] dark:hover:bg-white/10"
              aria-label="Ver carrito"
            >
              <ShoppingCart :size="18" class="text-gray-800 dark:text-gray-200" />
              <span
                v-if="itemCount > 0"
                class="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-black pt-0.5 text-[10px] font-bold leading-none text-white shadow-sm dark:border-gray-950"
              >
                {{ itemCount > 99 ? "99+" : itemCount }}
              </span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </header>

    <!-- MAIN CONTENT -->
    <main class="flex-1 pb-24">
      <slot />
    </main>

    <!-- PWA INSTALL BANNER -->
    <div
      v-if="showBanner"
      class="fixed bottom-[90px] left-4 right-4 z-50 rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:border-white/8 dark:bg-[#111]"
    >
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-900 dark:bg-white">
          <svg
            xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class="text-white dark:text-gray-900"
          >
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" />
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">Instala esta tienda</p>
          <p v-if="isIos" class="text-xs text-gray-500 dark:text-gray-400">
            Toca compartir y luego "Agregar a inicio"
          </p>
          <p v-else class="text-xs text-gray-500 dark:text-gray-400">Accede rapido desde tu celular</p>
        </div>
        <button
          v-if="canInstall"
          class="flex-shrink-0 rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-gray-900"
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

    <!-- BOTTOM NAVIGATION -->
    <nav class="fixed bottom-0 w-full border-t border-gray-100 bg-white pb-[env(safe-area-inset-bottom)] pt-3 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] dark:border-white/8 dark:bg-black">
      <div class="flex items-center justify-around px-4">
        <!-- Catalogo -->
        <NuxtLink
          to="/tienda"
          class="flex flex-col items-center gap-0.5 transition-colors"
          :class="isActive('/tienda') && !route.path.startsWith('/tienda/') ? 'text-gray-900 dark:text-white' : route.path === '/tienda' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'"
        >
          <LayoutGrid :size="22" />
          <span class="text-[10px] font-semibold">Catalogo</span>
        </NuxtLink>

        <!-- Info -->
        <NuxtLink
          to="/tienda/info"
          class="flex flex-col items-center gap-0.5 transition-colors"
          :class="isActive('/tienda/info') ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'"
        >
          <Store :size="22" />
          <span class="text-[10px] font-semibold">Info</span>
        </NuxtLink>

        <!-- Cart (center, elevated, dark pill) -->
        <NuxtLink
          to="/tienda/cart"
          class="relative -mt-8 flex h-[54px] w-[54px] items-center justify-center rounded-[18px] border-4 border-white bg-gray-900 text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)] transition-transform active:scale-95 dark:border-gray-950 dark:bg-white dark:text-gray-900"
          aria-label="Ver carrito"
        >
          <ShoppingCart :size="20" />
          <span
            v-if="itemCount > 0"
            class="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-red-500 pt-0.5 text-[10px] font-bold leading-none text-white dark:border-gray-950"
          >
            {{ itemCount > 99 ? "99+" : itemCount }}
          </span>
        </NuxtLink>

        <!-- WhatsApp -->
        <a
          v-if="whatsappLink"
          :href="whatsappLink"
          target="_blank"
          rel="noopener noreferrer"
          class="flex flex-col items-center gap-0.5 text-[#25D366] transition-colors"
          aria-label="WhatsApp"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <span class="text-[10px] font-semibold">WhatsApp</span>
        </a>
        <!-- Fallback: Pedir if no WhatsApp -->
        <NuxtLink
          v-else
          to="/tienda/checkout"
          class="flex flex-col items-center gap-0.5 transition-colors"
          :class="isActive('/tienda/checkout') ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'"
        >
          <Receipt :size="22" />
          <span class="text-[10px] font-semibold">Pedir</span>
        </NuxtLink>

        <!-- Pedir (only when WhatsApp is shown, to keep 5 items) -->
        <NuxtLink
          v-if="whatsappLink"
          to="/tienda/checkout"
          class="flex flex-col items-center gap-0.5 transition-colors"
          :class="isActive('/tienda/checkout') ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'"
        >
          <Receipt :size="22" />
          <span class="text-[10px] font-semibold">Pedir</span>
        </NuxtLink>
      </div>
    </nav>

    <!-- Footer -->
    <footer class="border-t border-gray-100 bg-white/60 py-6 dark:border-white/8 dark:bg-black/60">
      <div class="px-5 text-center text-xs text-gray-400 dark:text-gray-500">
        <p>Tienda en linea · Precios en USD</p>
        <p v-if="tenantSlug" class="mt-1">
          Powered by
          <a
            href="https://novaincs.com"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Nala
          </a>
        </p>
      </div>
    </footer>
  </div>
</template>
