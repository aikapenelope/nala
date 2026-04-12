<script setup lang="ts">
/**
 * PIN entry screen for employee identification on shared devices.
 *
 * Auth model (AUTH-REFACTOR-PLAN.md):
 * - The device is already authenticated via Clerk (owner signed in once)
 * - The PIN only identifies which employee is using the device
 * - PIN verification happens LOCALLY against the cached team roster
 * - No API call is made for PIN entry
 *
 * Shown when:
 * - The device has a cached roster (owner configured it before)
 * - An employee needs to identify themselves to start working
 * - A user taps "Switch user" in the sidebar/header
 */

import { PIN_LENGTH } from "@nova/shared";

definePageMeta({ layout: false });

const router = useRouter();
const { switchUser } = useNovaAuth();
const { roster, isLoaded, loadFromCache, businessName } = useTeamRoster();

const pin = ref("");
const error = ref("");
const isVerifying = ref(false);

/** Load roster from cache on mount. */
onMounted(() => {
  loadFromCache();
});

/** Employee list from the cached roster (for quick-select shortcuts). */
const employees = computed(() =>
  roster.value.map((e) => ({ id: e.id, name: e.name, role: e.role })),
);

/** Handle digit press on the keypad. */
function pressDigit(digit: string) {
  if (isVerifying.value) return;
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

/** Submit PIN for local verification. */
async function submitPin() {
  if (pin.value.length !== PIN_LENGTH) return;

  if (!isLoaded.value) {
    error.value =
      "Este dispositivo no esta configurado. El dueno debe iniciar sesion primero.";
    pin.value = "";
    return;
  }

  isVerifying.value = true;
  error.value = "";

  try {
    const result = await switchUser(pin.value);

    if (result.success) {
      router.push("/");
      return;
    }

    error.value = result.error ?? "PIN incorrecto";
    pin.value = "";
  } catch {
    error.value = "Error de verificacion";
    pin.value = "";
  } finally {
    isVerifying.value = false;
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
    <!-- Business name from roster -->
    <div class="mb-8 text-center">
      <h1 class="text-2xl font-bold text-nova-primary">
        {{ businessName ?? "Nova" }}
      </h1>
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
    <p v-if="error" class="mb-4 text-center text-sm font-medium text-red-500">
      {{ error }}
    </p>

    <!-- Numeric keypad -->
    <div class="w-full max-w-xs">
      <div
        v-for="(row, rowIdx) in keypadRows"
        :key="rowIdx"
        class="mb-3 flex justify-center gap-3"
      >
        <button
          v-for="digit in row"
          :key="digit"
          class="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-semibold text-gray-800 shadow-sm transition-colors active:bg-gray-100"
          :disabled="isVerifying"
          @click="pressDigit(digit)"
        >
          {{ digit }}
        </button>
      </div>

      <!-- Bottom row: delete, 0, empty -->
      <div class="flex justify-center gap-3">
        <button
          class="flex h-16 w-16 items-center justify-center rounded-full text-xl text-gray-500"
          @click="deleteDigit"
        >
          ←
        </button>
        <button
          class="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-semibold text-gray-800 shadow-sm transition-colors active:bg-gray-100"
          :disabled="isVerifying"
          @click="pressDigit('0')"
        >
          0
        </button>
        <div class="h-16 w-16" />
      </div>
    </div>

    <!-- Employee shortcuts from cached roster -->
    <div
      v-if="employees.length > 0"
      class="mt-8 flex flex-wrap justify-center gap-2"
    >
      <span
        v-for="emp in employees"
        :key="emp.id"
        class="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
      >
        {{ emp.name }}
      </span>
    </div>

    <!-- Link to owner login -->
    <div class="mt-8">
      <NuxtLink
        to="/auth/login"
        class="text-sm text-nova-primary hover:underline"
      >
        Iniciar como dueno
      </NuxtLink>
    </div>
  </div>
</template>
