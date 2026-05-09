<script setup lang="ts">
/**
 * Storefront layout - standalone public store experience.
 *
 * No sidebar, no header, no auth required.
 * Used by /tienda/* pages when accessed via tenant subdomain.
 * Clean, minimal design focused on the shopping experience.
 */

const { tenantSlug } = useTenant();
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Minimal header with store branding -->
    <header class="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <NuxtLink to="/tienda" class="text-lg font-bold text-gray-900">
          <slot name="store-name">Tienda</slot>
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
          <!-- Cart badge (provided by useCart) -->
          <slot name="cart-badge" />
        </NuxtLink>
      </div>
    </header>

    <!-- Main content -->
    <main class="mx-auto max-w-3xl px-4 py-6">
      <slot />
    </main>

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
