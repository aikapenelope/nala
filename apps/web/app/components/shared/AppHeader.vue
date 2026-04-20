<script setup lang="ts">
/**
 * App header bar with business open/close toggle.
 *
 * Shows: business name, open/close toggle (Apple style), role badge, Clerk user.
 * The toggle checks GET /cash-opening/latest to determine if the business
 * is open today. Tapping it when closed opens a quick cash declaration.
 */

defineProps<{
  businessName?: string;
  exchangeRate?: number;
}>();

const { user, isAdmin } = useNovaAuth();
const { $api } = useApi();

/** Business open/close state. */
const isOpen = ref<boolean | null>(null);
const isCheckingStatus = ref(true);

/** Quick open modal. */
const showOpenModal = ref(false);
const openAmount = ref(0);
const isOpening = ref(false);
const openError = ref("");

/** Check if business is open today. */
async function checkOpenStatus() {
  isCheckingStatus.value = true;
  try {
    const result = await $api<{ opening: unknown | null }>(
      "/api/cash-opening/latest",
    );
    isOpen.value = result.opening !== null;
  } catch {
    isOpen.value = null;
  } finally {
    isCheckingStatus.value = false;
  }
}

/** Toggle: if closed, show open modal. If open, do nothing (close is in day-close page). */
function handleToggle() {
  if (isOpen.value) {
    // Already open - navigate to day close
    navigateTo("/accounts/day-close");
  } else {
    // Closed - show quick open modal
    openAmount.value = 0;
    openError.value = "";
    showOpenModal.value = true;
  }
}

/** Submit cash opening. */
async function submitOpen() {
  if (openAmount.value < 0) {
    openError.value = "El monto no puede ser negativo";
    return;
  }
  isOpening.value = true;
  openError.value = "";
  try {
    await $api("/api/cash-opening", {
      method: "POST",
      body: { cashAmount: openAmount.value },
    });
    isOpen.value = true;
    showOpenModal.value = false;
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    openError.value = fetchError.data?.error ?? "Error abriendo caja";
  } finally {
    isOpening.value = false;
  }
}

onMounted(() => {
  if (isAdmin.value) {
    checkOpenStatus();
  }
});
</script>

<template>
  <header
    class="glass-strong mx-2 mb-3 mt-2 flex h-14 items-center justify-between rounded-2xl px-4 shadow-[0_4px_15px_-3px_rgba(0,0,0,0.04)]"
  >
    <!-- Left: Business name + role -->
    <div class="flex items-center gap-2">
      <span class="text-sm font-extrabold tracking-tight text-gray-900">
        {{ businessName ?? "Nova" }}
      </span>
      <span
        v-if="user && !isAdmin"
        class="rounded-xl bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600"
      >
        {{ user.name }}
      </span>
    </div>

    <!-- Right: Open/Close toggle + Clerk -->
    <div class="flex items-center gap-3">
      <!-- Open/Close toggle (admin only) -->
      <button
        v-if="isAdmin && !isCheckingStatus"
        class="flex items-center gap-2 rounded-full py-1 pl-3 pr-1 text-[11px] font-bold transition-spring"
        :class="
          isOpen
            ? 'bg-green-500/15 text-green-700'
            : 'bg-gray-200 text-gray-500'
        "
        @click="handleToggle"
      >
        <span>{{ isOpen ? "Abierto" : "Cerrado" }}</span>
        <!-- Apple-style toggle -->
        <div
          class="relative h-6 w-11 rounded-full transition-colors duration-300"
          :class="isOpen ? 'bg-green-500' : 'bg-gray-300'"
        >
          <div
            class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-300"
            :class="isOpen ? 'left-[22px]' : 'left-0.5'"
          />
        </div>
      </button>

      <!-- Clerk UserButton -->
      <Show when="signed-in">
        <UserButton />
      </Show>

      <Show when="signed-out">
        <SignInButton mode="modal">
          <button class="dark-pill rounded-xl px-4 py-1.5 text-xs font-bold">
            Iniciar sesion
          </button>
        </SignInButton>
      </Show>
    </div>
  </header>

  <!-- Quick open modal -->
  <Teleport to="body">
    <div
      v-if="showOpenModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      @click.self="showOpenModal = false"
    >
      <div class="glass-strong w-full max-w-xs rounded-[28px] p-6 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.2)]">
        <h3 class="mb-1 text-lg font-extrabold tracking-tight text-gray-900">
          Abrir caja
        </h3>
        <p class="mb-4 text-[13px] text-gray-500">
          Cuanto efectivo hay en caja?
        </p>
        <input
          v-model.number="openAmount"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-center text-2xl font-extrabold text-gray-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none focus:ring-[3px] focus:ring-green-500/20 transition-spring placeholder:text-gray-300"
          autofocus
        >
        <p v-if="openError" class="mt-2 text-center text-xs text-red-500">
          {{ openError }}
        </p>
        <div class="mt-4 flex gap-3">
          <button
            class="glass flex-1 rounded-2xl py-2.5 text-sm font-bold text-gray-600 transition-spring"
            @click="showOpenModal = false"
          >
            Cancelar
          </button>
          <button
            class="flex-1 rounded-2xl bg-green-600 py-2.5 text-sm font-bold text-white transition-spring disabled:opacity-50"
            :disabled="isOpening"
            @click="submitOpen"
          >
            {{ isOpening ? "Abriendo..." : "Abrir" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
