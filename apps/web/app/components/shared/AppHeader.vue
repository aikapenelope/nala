<script setup lang="ts">
/**
 * App header bar.
 *
 * Shows business name, BCV exchange rate, current user badge,
 * and Clerk UserButton for signed-in owners.
 * Adapts to desktop (inside main area) and mobile (full width).
 */

defineProps<{
  businessName?: string;
  exchangeRate?: number;
}>();

const { user, isAdmin } = useNovaAuth();
</script>

<template>
  <header
    class="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4"
  >
    <!-- Business name -->
    <div class="flex items-center gap-2">
      <span class="text-sm font-semibold text-gray-900">
        {{ businessName ?? "Nova" }}
      </span>
      <!-- Role indicator -->
      <span
        v-if="user"
        class="rounded-full px-2 py-0.5 text-xs font-medium"
        :class="
          isAdmin
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-600'
        "
      >
        {{ isAdmin ? "Admin" : user.name }}
      </span>
    </div>

    <!-- Right side: exchange rate + user controls -->
    <div class="flex items-center gap-4">
      <!-- BCV exchange rate -->
      <span v-if="exchangeRate" class="text-xs text-gray-500">
        Bs.{{ exchangeRate.toFixed(2) }}
      </span>

      <!-- Clerk UserButton for signed-in owners -->
      <Show when="signed-in">
        <UserButton />
      </Show>

      <!-- Sign in button when not authenticated -->
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            class="rounded-lg bg-nova-primary px-3 py-1.5 text-sm font-medium text-white"
          >
            Iniciar sesión
          </button>
        </SignInButton>
      </Show>
    </div>
  </header>
</template>
