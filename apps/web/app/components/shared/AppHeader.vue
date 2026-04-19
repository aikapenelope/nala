<script setup lang="ts">
/**
 * App header bar - premium glass design.
 *
 * Shows business name, role badge, and Clerk UserButton.
 * Glass background with rounded corners to match the design system.
 */

defineProps<{
  businessName?: string;
  exchangeRate?: number;
}>();

const { user, isAdmin } = useNovaAuth();
</script>

<template>
  <header
    class="glass-strong mx-2 mb-3 mt-2 flex h-14 items-center justify-between rounded-2xl px-5 shadow-[0_4px_15px_-3px_rgba(0,0,0,0.04)]"
  >
    <!-- Business name -->
    <div class="flex items-center gap-2.5">
      <span class="text-sm font-extrabold tracking-tight text-gray-900">
        {{ businessName ?? "Nova" }}
      </span>
      <span
        v-if="user"
        class="rounded-xl px-2.5 py-0.5 text-[10px] font-bold"
        :class="
          isAdmin
            ? 'bg-nova-accent/10 text-nova-accent'
            : 'bg-gray-100 text-gray-600'
        "
      >
        {{ isAdmin ? "Admin" : user.name }}
      </span>
    </div>

    <!-- Right side -->
    <div class="flex items-center gap-3">
      <span v-if="exchangeRate" class="text-xs font-semibold text-gray-400">
        Bs.{{ exchangeRate.toFixed(2) }}
      </span>

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
</template>
