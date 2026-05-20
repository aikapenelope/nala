<script setup lang="ts">
/**
 * Default layout with premium glassmorphism design.
 *
 * Desktop (>1025px): Glass sidebar + main content on gradient bg.
 * Mobile (<768px): Content + glass bottom tabs.
 *
 * Includes owner lock guard: pages in LOCKED_ROUTES are hidden
 * until the lock status is resolved. This prevents the "flash of
 * protected content" that was visible for 300-800ms before the
 * redirect to /unlock kicked in.
 */

import { LOCKED_ROUTES } from "~/utils/locked-routes";

const { isDesktop } = useDevice();
const { user } = useNovaAuth();
const { sessionExpired } = useApi();
const { isLocked, isReady } = useOwnerLock();
const route = useRoute();

const { updateAvailable, applyUpdate } = usePwaUpdate();

const businessName = computed(() => user.value?.businessName || "Nova");

/**
 * Whether the current route is protected by the owner lock.
 * Only these routes get the content-hiding guard.
 */
const isProtectedRoute = computed(() =>
  LOCKED_ROUTES.some(
    (r) => route.path === r || route.path.startsWith(r + "/"),
  ),
);

/**
 * Whether to show the page content.
 * - Non-protected routes: always show
 * - Protected routes: show only when lock status is resolved AND unlocked
 */
const showContent = computed(() => {
  if (!isProtectedRoute.value) return true;
  if (!isReady.value) return false; // Still checking lock status
  return !isLocked.value;
});

function reAuthenticate() {
  sessionExpired.value = false;
  const novaUser = useState("nova-user");
  novaUser.value = null;
  navigateTo("/auth/login");
}
</script>

<template>
  <div
    class="min-h-screen bg-gradient-to-br from-[#f8f7ff] via-[#f0eef9] to-[#e8e4f3]"
  >
    <!-- PWA update available banner -->
    <Transition name="slide-down">
      <div
        v-if="updateAvailable"
        class="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-3 bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg"
      >
        <span class="font-medium">Nueva version disponible</span>
        <button
          class="rounded-lg bg-white px-3 py-1 text-xs font-bold text-gray-900 transition-transform active:scale-95"
          @click="applyUpdate"
        >
          Actualizar
        </button>
      </div>
    </Transition>

    <!-- Global search (Cmd+K) -->
    <SharedCommandPalette />

    <!-- Global toast notifications -->
    <SharedToastContainer />

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
      <DesktopSidebar class="flex-shrink-0" />
      <div class="flex min-w-0 flex-1 flex-col overflow-hidden pl-3">
        <SharedAppHeader :business-name="businessName" />
        <main class="flex-1 overflow-y-auto p-5">
          <slot v-if="showContent" />
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
        <slot v-if="showContent" />
      </main>
      <MobileBottomTabs />
    </div>
  </div>
</template>
