<script setup lang="ts">
/**
 * Owner Lock Guard component.
 *
 * Wraps sensitive content. Self-initializing: on mount, it checks
 * the lock status from the API (if not already checked) and shows
 * the PIN overlay if the lock is active.
 *
 * No dependency on plugins, useState, or SSR hydration.
 * Works purely client-side after mount.
 *
 * Usage:
 *   <OwnerLockGuard message="Ingresa tu clave para ver reportes">
 *     ...sensitive content...
 *   </OwnerLockGuard>
 */

import { Lock } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    message?: string;
  }>(),
  {
    message: "Contenido protegido",
  },
);

const { isLocked, isLoading, ensureInitialized, unlock } = useOwnerLock();

/** Whether the component has mounted (lock only enforced after mount). */
const mounted = ref(false);

onMounted(async () => {
  await ensureInitialized();
  mounted.value = true;
});

/** Show lock overlay only after mount and only if locked. */
const showLock = computed(() => mounted.value && isLocked.value);

/** Show loading state while checking lock status. */
const showLoading = computed(() => mounted.value && isLoading.value);

const pin = ref("");
const error = ref("");
const isVerifying = ref(false);

function onDigit(digit: string) {
  if (pin.value.length >= 4) return;
  pin.value += digit;
  error.value = "";

  if (pin.value.length === 4) {
    verifyPin();
  }
}

function onBackspace() {
  pin.value = pin.value.slice(0, -1);
  error.value = "";
}

async function verifyPin() {
  if (pin.value.length !== 4) return;

  isVerifying.value = true;
  error.value = "";

  const result = await unlock(pin.value);

  if (!result.success) {
    error.value = result.error ?? "Clave incorrecta";
    pin.value = "";
  }

  isVerifying.value = false;
}

const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];
</script>

<template>
  <!-- SSR + before mount: render content normally (no lock enforcement) -->
  <!-- After mount + not locked: render content -->
  <slot v-if="!showLock && !showLoading" />

  <!-- Loading: checking lock status -->
  <div
    v-else-if="showLoading"
    class="flex min-h-[60vh] items-center justify-center"
  >
    <div class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary" />
  </div>

  <!-- Locked: show PIN entry -->
  <div
    v-else
    class="flex min-h-[60vh] flex-col items-center justify-center px-4"
  >
    <div class="w-full max-w-xs text-center">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <Lock :size="28" class="text-gray-400" />
      </div>

      <p class="mb-2 text-base font-bold text-gray-800">{{ props.message }}</p>
      <p class="mb-6 text-sm text-gray-500">Ingresa tu clave de 4 digitos</p>

      <!-- PIN dots -->
      <div class="mb-6 flex justify-center gap-3">
        <div
          v-for="i in 4"
          :key="i"
          class="h-3.5 w-3.5 rounded-full transition-all duration-200"
          :class="[
            i <= pin.length ? 'bg-nova-primary scale-110' : 'bg-gray-200',
            error && pin.length === 0 ? 'bg-red-200' : '',
          ]"
        />
      </div>

      <p v-if="error" class="mb-4 text-sm font-semibold text-red-500">
        {{ error }}
      </p>

      <div v-if="isVerifying" class="mb-4 flex justify-center">
        <div class="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary" />
      </div>

      <!-- PIN pad -->
      <div v-if="!isVerifying" class="mx-auto grid max-w-[240px] grid-cols-3 gap-2">
        <template v-for="d in digits" :key="d">
          <div v-if="d === ''" />
          <button
            v-else-if="d === 'back'"
            class="flex h-14 items-center justify-center rounded-2xl text-gray-500 transition-colors active:bg-gray-100"
            @click="onBackspace"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
          </button>
          <button
            v-else
            class="flex h-14 items-center justify-center rounded-2xl bg-gray-50 text-lg font-bold text-gray-800 transition-colors active:bg-gray-200"
            @click="onDigit(d)"
          >
            {{ d }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
