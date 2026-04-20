<script setup lang="ts">
/**
 * Owner PIN verification modal.
 *
 * Shown when an employee tries to perform a restricted action
 * (void sale, large discount, open cash drawer).
 * The owner enters their PIN to approve the action.
 */

import { PIN_LENGTH } from "@nova/shared";

const props = defineProps<{
  modelValue: boolean;
  actionLabel?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  verified: [];
  cancelled: [];
}>();

const pin = ref("");
const error = ref("");
const isLoading = ref(false);

function pressDigit(digit: string) {
  if (isLoading.value) return;
  if (pin.value.length >= PIN_LENGTH) return;

  error.value = "";
  pin.value += digit;

  if (pin.value.length === PIN_LENGTH) {
    verifyPin();
  }
}

function deleteDigit() {
  pin.value = pin.value.slice(0, -1);
  error.value = "";
}

async function verifyPin() {
  isLoading.value = true;
  error.value = "";

  try {
    const { verifyOwnerPin } = useNovaAuth();
    const valid = await verifyOwnerPin(pin.value);

    if (valid) {
      emit("verified");
      close();
    } else {
      error.value = "PIN incorrecto";
      pin.value = "";
    }
  } catch {
    error.value = "Error de verificación";
    pin.value = "";
  } finally {
    isLoading.value = false;
  }
}

function close() {
  pin.value = "";
  error.value = "";
  emit("update:modelValue", false);
}

function cancel() {
  emit("cancelled");
  close();
}

const keypadRows = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      @click.self="cancel"
    >
      <div class="glass-strong w-full max-w-xs rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
        <!-- Title -->
        <h3 class="mb-1 text-center text-xl font-extrabold tracking-tight text-gradient">
          PIN del dueno
        </h3>
        <p class="mb-5 text-center text-[13px] font-medium text-gray-500">
          {{ actionLabel ?? "Esta accion requiere aprobacion" }}
        </p>

        <!-- PIN dots -->
        <div class="mb-5 flex justify-center gap-3">
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

        <!-- Error -->
        <p v-if="error" class="mb-3 text-center text-sm font-semibold text-red-500">
          {{ error }}
        </p>

        <!-- Keypad -->
        <div>
          <div
            v-for="(row, rowIdx) in keypadRows"
            :key="rowIdx"
            class="mb-2 flex justify-center gap-2"
          >
            <button
              v-for="digit in row"
              :key="digit"
              class="flex h-13 w-13 items-center justify-center rounded-2xl bg-white/60 text-xl font-bold text-gray-800 transition-spring active:scale-90 active:bg-white"
              @click="pressDigit(digit)"
            >
              {{ digit }}
            </button>
          </div>
          <div class="flex justify-center gap-2">
            <button
              class="flex h-13 w-13 items-center justify-center rounded-2xl text-lg text-gray-400 transition-spring hover:bg-white/40"
              @click="deleteDigit"
            >
              ←
            </button>
            <button
              class="flex h-13 w-13 items-center justify-center rounded-2xl bg-white/60 text-xl font-bold text-gray-800 transition-spring active:scale-90 active:bg-white"
              @click="pressDigit('0')"
            >
              0
            </button>
            <button
              class="flex h-13 w-13 items-center justify-center rounded-2xl text-[11px] font-bold text-gray-400 transition-spring hover:bg-white/40 hover:text-gray-600"
              @click="cancel"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
