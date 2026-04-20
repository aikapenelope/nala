<script setup lang="ts">
/**
 * PIN entry screen for employee identification on shared devices.
 *
 * This screen appears on devices in "store mode" (shared tablet/PC).
 * Employees enter their 4-digit PIN to identify themselves.
 * The owner can also enter their PIN to get admin access.
 *
 * PIN verification happens LOCALLY against the cached team roster
 * (bcrypt in browser). No API call is made for PIN entry.
 */

import { PIN_LENGTH } from "@nova/shared";
import { Store, User, ShieldCheck, RotateCcw } from "lucide-vue-next";

definePageMeta({ layout: false });

const router = useRouter();
const { switchUser, fullLogout } = useNovaAuth();
const { roster, isLoaded, loadFromCache, businessName } = useTeamRoster();
const { isStoreMode } = useDeviceMode();

const pin = ref("");
const error = ref("");
const isVerifying = ref(false);

/** Load roster from cache on mount. */
onMounted(() => {
  loadFromCache();
});

/** Separate owner and employees for display. */
const owner = computed(() =>
  roster.value.find((e) => e.role === "owner"),
);
const employees = computed(() =>
  roster.value.filter((e) => e.role === "employee"),
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

/** Reset device: clear everything and go to landing. */
function resetDevice() {
  fullLogout();
  navigateTo("/landing");
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
    class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#f8f7ff] via-[#f0eef9] to-[#e8e4f3] px-4"
  >
    <!-- Business name + device mode indicator -->
    <div class="mb-6 text-center">
      <div class="mx-auto mb-3 dark-pill inline-flex h-12 w-12 items-center justify-center rounded-2xl">
        <Store :size="20" class="text-white" />
      </div>
      <h1 class="text-2xl font-extrabold tracking-tight text-gradient">
        {{ businessName ?? "Nova" }}
      </h1>
      <p v-if="isStoreMode" class="mt-1 text-[13px] font-medium text-gray-500">
        Dispositivo de tienda · Ingresa tu PIN
      </p>
      <p v-else class="mt-1 text-[13px] font-medium text-gray-500">
        Ingresa tu PIN para continuar
      </p>
    </div>

    <!-- Instructions card (only shown when roster is loaded) -->
    <div
      v-if="isLoaded && (employees.length > 0 || owner)"
      class="glass-strong mb-6 w-full max-w-xs rounded-[24px] p-4"
    >
      <p class="mb-2.5 text-[11px] font-bold tracking-wider text-gray-400 uppercase">Equipo activo</p>

      <!-- Owner -->
      <div v-if="owner" class="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
        <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-nova-accent/15">
          <ShieldCheck :size="13" class="text-nova-accent" />
        </div>
        <span class="text-[12px] font-bold text-gray-700">{{ owner.name }}</span>
        <span class="rounded-md bg-nova-accent/10 px-1.5 py-0.5 text-[9px] font-bold text-nova-accent">Admin</span>
      </div>

      <!-- Employees -->
      <div
        v-for="emp in employees"
        :key="emp.id"
        class="flex items-center gap-2.5 rounded-xl px-2 py-1.5"
      >
        <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
          <User :size="13" class="text-gray-500" />
        </div>
        <span class="text-[12px] font-semibold text-gray-600">{{ emp.name }}</span>
      </div>

      <!-- Empty state -->
      <p v-if="employees.length === 0" class="mt-1 px-2 text-[11px] text-gray-400">
        No hay empleados. El dueno puede agregarlos en Config. > Equipo.
      </p>
    </div>

    <!-- Not configured state -->
    <div
      v-else-if="!isLoaded"
      class="glass-strong mb-6 w-full max-w-xs rounded-[24px] p-5 text-center"
    >
      <p class="text-[13px] font-semibold text-gray-600">
        Este dispositivo no esta configurado
      </p>
      <p class="mt-1.5 text-[11px] text-gray-400">
        El dueno debe iniciar sesion una vez para activar este dispositivo.
      </p>
    </div>

    <!-- PIN dots indicator -->
    <div class="mb-5 flex gap-3">
      <div
        v-for="i in PIN_LENGTH"
        :key="i"
        class="h-3.5 w-3.5 rounded-full transition-all duration-300"
        :class="
          i <= pin.length
            ? 'bg-nova-accent shadow-[0_0_8px_rgba(139,92,246,0.4)] scale-110'
            : 'border-2 border-gray-300/60 bg-white/60'
        "
      />
    </div>

    <!-- Error message -->
    <p v-if="error" class="mb-4 text-center text-sm font-semibold text-red-500">
      {{ error }}
    </p>

    <!-- Numeric keypad -->
    <div class="w-full max-w-[240px]">
      <div
        v-for="(row, rowIdx) in keypadRows"
        :key="rowIdx"
        class="mb-2 flex justify-center gap-2"
      >
        <button
          v-for="digit in row"
          :key="digit"
          class="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/60 text-xl font-bold text-gray-800 transition-spring active:scale-90 active:bg-white"
          :disabled="isVerifying"
          @click="pressDigit(digit)"
        >
          {{ digit }}
        </button>
      </div>

      <!-- Bottom row: delete, 0, empty -->
      <div class="flex justify-center gap-2">
        <button
          class="flex h-14 w-14 items-center justify-center rounded-2xl text-lg text-gray-400 transition-spring hover:bg-white/40"
          @click="deleteDigit"
        >
          ←
        </button>
        <button
          class="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/60 text-xl font-bold text-gray-800 transition-spring active:scale-90 active:bg-white"
          :disabled="isVerifying"
          @click="pressDigit('0')"
        >
          0
        </button>
        <div class="h-14 w-14" />
      </div>
    </div>

    <!-- Owner login link (prominent, not hidden) -->
    <div class="mt-8 text-center">
      <NuxtLink
        to="/auth/login"
        class="glass inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-gray-700 transition-spring hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08)]"
      >
        <ShieldCheck :size="16" class="text-nova-accent" />
        Iniciar como dueno
      </NuxtLink>
      <p class="mt-2 text-[10px] text-gray-400">
        Solo necesario la primera vez o si la sesion expiro
      </p>
    </div>

    <!-- Reset device (escape hatch when stuck) -->
    <button
      class="mt-6 inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-400 transition-spring hover:text-red-500"
      @click="resetDevice"
    >
      <RotateCcw :size="12" />
      Resetear dispositivo
    </button>
  </div>
</template>
