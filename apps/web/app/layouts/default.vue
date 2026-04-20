<script setup lang="ts">
/**
 * Default layout with premium glassmorphism design.
 *
 * Desktop (>1025px): Glass sidebar + main content on gradient bg.
 * Mobile (<768px): Content + glass bottom tabs.
 */

const { isDesktop } = useDevice();
const { user } = useNovaAuth();
const { sessionExpired } = useApi();

const businessName = computed(() => user.value?.businessName || "Nova");

function reAuthenticate() {
  sessionExpired.value = false;
  // Clear all stale user state so the login flow starts completely fresh
  const novaUser = useState("nova-user");
  novaUser.value = null;
  if (import.meta.client) {
    localStorage.removeItem("nova:user");
  }
  navigateTo("/auth/login");
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-[#f8f7ff] via-[#f0eef9] to-[#e8e4f3]">
    <!-- Session expired banner -->
    <div
      v-if="sessionExpired"
      class="fixed inset-x-0 top-0 z-50 px-4 py-3 text-center text-sm text-white shadow-lg dark-pill"
    >
      <p class="font-medium">
        Sesion expirada. El dueno debe iniciar sesion de nuevo.
      </p>
      <button
        class="mt-1 rounded-lg bg-white px-4 py-1 text-xs font-semibold text-gray-900"
        @click="reAuthenticate"
      >
        Iniciar sesion
      </button>
    </div>

    <!-- Desktop layout -->
    <div
      v-if="isDesktop"
      class="flex h-screen p-3"
      :class="{ 'pt-16': sessionExpired }"
    >
      <DesktopSidebar />
      <div class="flex flex-1 flex-col overflow-hidden pl-3">
        <SharedAppHeader :business-name="businessName" />
        <main class="flex-1 overflow-y-auto p-5">
          <slot />
        </main>
      </div>
    </div>

    <!-- Mobile layout -->
    <div
      v-else
      class="flex min-h-screen flex-col"
      :class="{ 'pt-16': sessionExpired }"
    >
      <SharedAppHeader :business-name="businessName" />
      <main class="flex-1 px-4 pb-24">
        <slot />
      </main>
      <MobileBottomTabs />
    </div>
  </div>
</template>
