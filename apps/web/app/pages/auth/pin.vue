<script setup lang="ts">
/**
 * PIN entry screen for employee authentication on shared devices.
 *
 * Shown when:
 * - The device has an active Clerk session (owner logged in once)
 * - An employee needs to identify themselves to start working
 * - A user taps "Switch user" in the header
 *
 * Design: Large numeric keypad (60px buttons), 4 dots indicator,
 * employee name shortcuts at the bottom.
 */

import { PIN_LENGTH } from "@nova/shared";

const pin = ref("");
const error = ref("");
const isLocked = ref(false);
const isLoading = ref(false);

/** Employee list for quick-select shortcuts. */
const employees = ref<Array<{ id: string; name: string }>>([]);

/** Handle digit press on the keypad. */
function pressDigit(digit: string) {
  if (isLocked.value || isLoading.value) return;
  if (pin.value.length >= PIN_LENGTH) return;

  error.value = "";
  pin.value += digit;

  // Auto-submit when 4 digits entered
  if (pin.value.length === PIN_LENGTH) {
    submitPin();
  }
}

/** Delete last digit. */
function deleteDigit() {
  pin.value = pin.value.slice(0, -1);
  error.value = "";
}

/** Submit PIN for verification. */
async function submitPin() {
  if (pin.value.length !== PIN_LENGTH) return;

  isLoading.value = true;
  error.value = "";

  try {
    // TODO: Call API to verify PIN
    // const result = await $fetch('/api/auth/pin', {
    //   method: 'POST',
    //   body: { pin: pin.value }
    // });

    // Placeholder: always fail until API is connected
    error.value = "PIN incorrecto";
    pin.value = "";
  } catch {
    error.value = "Error de conexión";
    pin.value = "";
  } finally {
    isLoading.value = false;
  }
}

/** Digits for the keypad grid. */
const keypadRows = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4"
  >
    <!-- Business name -->
    <div class="mb-8 text-center">
      <h1 class="text-2xl font-bold text-nova-primary">Nova</h1>
      <p class="mt-1 text-sm text-gray-500">Ingresa tu PIN</p>
    </div>

    <!-- PIN dots indicator -->
    <div class="mb-6 flex gap-3">
      <div
        v-for="i in PIN_LENGTH"
        :key="i"
        class="h-4 w-4 rounded-full transition-colors"
        :class="
          i <= pin.length
            ? 'bg-nova-primary'
            : 'border-2 border-gray-300 bg-white'
        "
      />
    </div>

    <!-- Error message -->
    <p v-if="error" class="mb-4 text-sm font-medium text-red-500">
      {{ error }}
    </p>

    <!-- Locked message -->
    <p v-if="isLocked" class="mb-4 text-sm text-red-500">
      Demasiados intentos. Espera 5 minutos.
    </p>

    <!-- Numeric keypad -->
    <div class="w-full max-w-xs">
      <div v-for="(row, rowIdx) in keypadRows" :key="rowIdx" class="mb-3 flex justify-center gap-3">
        <button
          v-for="digit in row"
          :key="digit"
          class="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-semibold text-gray-800 shadow-sm transition-colors active:bg-gray-100"
          :disabled="isLocked || isLoading"
          @click="pressDigit(digit)"
        >
          {{ digit }}
        </button>
      </div>

      <!-- Bottom row: delete, 0, submit -->
      <div class="flex justify-center gap-3">
        <button
          class="flex h-16 w-16 items-center justify-center rounded-full text-xl text-gray-500"
          @click="deleteDigit"
        >
          ←
        </button>
        <button
          class="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-semibold text-gray-800 shadow-sm transition-colors active:bg-gray-100"
          :disabled="isLocked || isLoading"
          @click="pressDigit('0')"
        >
          0
        </button>
        <div class="h-16 w-16" />
      </div>
    </div>

    <!-- Employee shortcuts -->
    <div v-if="employees.length > 0" class="mt-8 flex flex-wrap justify-center gap-2">
      <button
        v-for="emp in employees"
        :key="emp.id"
        class="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
      >
        {{ emp.name }}
      </button>
    </div>

    <!-- Link to owner login -->
    <div class="mt-8">
      <NuxtLink
        to="/auth/login"
        class="text-sm text-nova-primary hover:underline"
      >
        Iniciar como dueño
      </NuxtLink>
    </div>
  </div>
</template>
