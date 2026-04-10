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
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="cancel"
    >
      <div class="w-full max-w-xs rounded-2xl bg-white p-6 shadow-xl">
        <!-- Title -->
        <h3 class="mb-1 text-center text-lg font-semibold text-gray-900">
          PIN del dueño
        </h3>
        <p class="mb-4 text-center text-sm text-gray-500">
          {{ actionLabel ?? "Esta acción requiere aprobación" }}
        </p>

        <!-- PIN dots -->
        <div class="mb-4 flex justify-center gap-3">
          <div
            v-for="i in PIN_LENGTH"
            :key="i"
            class="h-3 w-3 rounded-full transition-colors"
            :class="
              i <= pin.length
                ? 'bg-nova-primary'
                : 'border-2 border-gray-300 bg-white'
            "
          />
        </div>

        <!-- Error -->
        <p v-if="error" class="mb-3 text-center text-sm text-red-500">
          {{ error }}
        </p>

        <!-- Keypad -->
        <div>
          <div v-for="(row, rowIdx) in keypadRows" :key="rowIdx" class="mb-2 flex justify-center gap-2">
            <button
              v-for="digit in row"
              :key="digit"
              class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-xl font-semibold text-gray-800 active:bg-gray-200"
              @click="pressDigit(digit)"
            >
              {{ digit }}
            </button>
          </div>
          <div class="flex justify-center gap-2">
            <button
              class="flex h-12 w-12 items-center justify-center rounded-full text-lg text-gray-500"
              @click="deleteDigit"
            >
              ←
            </button>
            <button
              class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-xl font-semibold text-gray-800 active:bg-gray-200"
              @click="pressDigit('0')"
            >
              0
            </button>
            <button
              class="flex h-12 w-12 items-center justify-center rounded-full text-sm text-gray-500"
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
