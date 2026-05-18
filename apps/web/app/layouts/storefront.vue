<script setup lang="ts">
/**
 * Storefront layout - premium public store experience.
 *
 * Clean, modern design with:
 * - Minimal white header with business name + cart
 * - Full-bleed content area
 * - Fixed bottom navigation (Catalog, Saved, Cart, Orders, Profile)
 * - PWA install banner
 * - No auth required
 */

import {
  LayoutGrid,
  ShoppingCart,
  Info,
  MessageCircle,
} from "lucide-vue-next";

const config = useRuntimeConfig();
const { tenantSlug } = useTenant();
const { business } = useStorefront();
const { itemCount } = useCart();
const { showBanner, canInstall, isIos, install, dismiss } = usePwaInstall();

const route = useRoute();

/** Display name: business name when loaded, generic fallback otherwise. */
const storeName = computed(() => business.value?.name ?? "Tienda");

/** Subdomain display — uses tenantDomain from runtime config. */
const storeUrl = computed(() => {
  if (!tenantSlug.value) return null;
  const host = (config.public.tenantDomain as string) || "novaincs.com";
  return `${tenantSlug.value}.${host}`;
});

/** WhatsApp link for the business. */
const whatsappLink = computed(() => {
  const phone = business.value?.whatsappNumber;
  if (!phone) return null;
  const clean = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${clean}`;
});

/**
 * Bottom nav items — only routes that exist in the storefront.
 * Catalog, Cart (elevated center), and Order tracking.
 * "Guardados" and "Perfil" are omitted because those pages don't exist yet.
 */
const navItems = computed(() => [
  { to: "/tienda", icon: LayoutGrid, label: "Catalogo", match: "/tienda" },
  { to: "/tienda/cart", icon: ShoppingCart, label: "Carrito", isCart: true, match: "/tienda/cart" },
  { to: "/tienda/info", icon: Info, label: "Info", match: "/tienda/info" },
]);

function isActive(match: string): boolean {
  if (match === "/tienda") return route.path === "/tienda";
  return route.path.startsWith(match);
}

/** Handle the install button click. */
async function handleInstall() {
  if (canInstall.value) {
    await install();
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-white">
    <!-- HEADER -->
    <header class="shrink-0 bg-white pt-[env(safe-area-inset-top)] z-30">
      <div class="px-5 pb-3 pt-4">
        <div class="flex items-center justify-between">
          <div class="flex flex-col">
            <NuxtLink to="/tienda" class="text-2xl font-bold tracking-tight text-gray-900">
              {{ storeName }}
            </NuxtLink>
            <p
              v-if="storeUrl"
              class="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-gray-500"
            >
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {{ storeUrl }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <!-- WhatsApp -->
            <a
              v-if="whatsappLink"
              :href="whatsappLink"
              target="_blank"
              rel="noopener noreferrer"
              class="flex h-11 w-11 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-green-600 transition-colors hover:bg-green-50"
              aria-label="WhatsApp"
            >
              <MessageCircle :size="20" />
            </a>

            <!-- Cart -->
            <NuxtLink
              to="/tienda/cart"
              class="relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-100 bg-gray-50 transition-colors hover:bg-gray-100"
              aria-label="Ver carrito"
            >
              <ShoppingCart :size="20" class="text-gray-800" />
              <span
                v-if="itemCount > 0"
                class="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-black pt-0.5 text-[10px] font-bold leading-none text-white shadow-sm"
              >
                {{ itemCount > 99 ? "99+" : itemCount }}
              </span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </header>

    <!-- MAIN CONTENT -->
    <main class="flex-1 pb-28">
      <slot />
    </main>

    <!-- PWA INSTALL BANNER -->
    <div
      v-if="showBanner"
      class="fixed bottom-[100px] left-4 right-4 z-50 rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
    >
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-900">
          <svg
            xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          >
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" />
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900">Instala esta tienda</p>
          <p v-if="isIos" class="text-xs text-gray-500">
            Toca compartir y luego "Agregar a inicio"
          </p>
          <p v-else class="text-xs text-gray-500">Accede rapido desde tu celular</p>
        </div>
        <button
          v-if="canInstall"
          class="flex-shrink-0 rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white"
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

    <!-- BOTTOM NAVIGATION -->
    <nav class="fixed bottom-0 w-full border-t border-gray-100 bg-white pb-[env(safe-area-inset-bottom)] pt-4 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
      <div class="flex items-center justify-between px-6">
        <template v-for="item in navItems" :key="item.label">
          <!-- Cart button (elevated) -->
          <NuxtLink
            v-if="item.isCart"
            :to="item.to"
            class="relative -mt-10 flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border-4 border-white bg-gray-900 text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)] transition-transform active:scale-95"
          >
            <component :is="item.icon" :size="20" />
            <span
              v-if="itemCount > 0"
              class="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-blue-500 pt-0.5 text-[10px] font-bold leading-none text-white"
            >
              {{ itemCount > 99 ? "99+" : itemCount }}
            </span>
          </NuxtLink>

          <!-- Regular nav item -->
          <NuxtLink
            v-else
            :to="item.to"
            class="flex flex-col items-center gap-1 transition-colors"
            :class="isActive(item.match) ? 'text-gray-900' : 'text-gray-400 hover:text-gray-900'"
          >
            <div class="relative">
              <component :is="item.icon" :size="24" />
              <span
                v-if="isActive(item.match)"
                class="absolute -bottom-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-gray-900"
              />
            </div>
            <span class="text-[10px] font-semibold tracking-wide">{{ item.label }}</span>
          </NuxtLink>
        </template>
      </div>
    </nav>

    <!-- Footer (above bottom nav, inside scroll) -->
    <footer class="border-t border-gray-100 bg-white/60 py-6">
      <div class="px-5 text-center text-xs text-gray-400">
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
