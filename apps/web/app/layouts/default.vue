<script setup lang="ts">
/**
 * Default layout with responsive design.
 *
 * Desktop (>1025px): Sidebar left + header + main content area.
 * Mobile (<768px): Header + main content + bottom tabs.
 *
 * Based on the Square/Shopify pattern:
 * - Desktop = center of analysis and configuration
 * - Mobile = center of action and data capture
 *
 * Includes a session-expired banner that appears when the Clerk JWT
 * expires. The banner is non-blocking (doesn't redirect mid-sale)
 * and provides a clear action to re-authenticate.
 */

const { isDesktop } = useDevice();
const { user } = useNovaAuth();
const { sessionExpired } = useApi();

/** Show business name from auth state, fallback to "Nova". */
const businessName = computed(() => user.value?.businessName || "Nova");

/** Dismiss the banner and redirect to owner login. */
function reAuthenticate() {
  sessionExpired.value = false;
  navigateTo("/auth/login");
}
</script>

<template>
  <div>
    <!-- Session expired banner -->
    <div
      v-if="sessionExpired"
      class="fixed inset-x-0 top-0 z-50 bg-red-600 px-4 py-3 text-center text-sm text-white shadow-lg"
    >
      <p class="font-medium">
        Sesion expirada. El dueno debe iniciar sesion de nuevo.
      </p>
      <button
        class="mt-1 rounded-lg bg-white px-4 py-1 text-xs font-semibold text-red-600"
        @click="reAuthenticate"
      >
        Iniciar sesion
      </button>
    </div>

    <!-- Desktop layout: sidebar + main -->
    <div
      v-if="isDesktop"
      class="flex h-screen"
      :class="{ 'pt-14': sessionExpired }"
    >
      <DesktopSidebar />
      <div class="flex flex-1 flex-col overflow-hidden">
        <SharedAppHeader :business-name="businessName" />
        <main class="flex-1 overflow-y-auto bg-gray-50 p-6">
          <slot />
        </main>
      </div>
    </div>

    <!-- Mobile layout: header + content + bottom tabs -->
    <div
      v-else
      class="flex min-h-screen flex-col"
      :class="{ 'pt-14': sessionExpired }"
    >
      <SharedAppHeader :business-name="businessName" />
      <main class="flex-1 bg-gray-50 p-4 pb-20">
        <slot />
      </main>
      <MobileBottomTabs />
    </div>
  </div>
</template>
