<script setup lang="ts">
/**
 * App header bar.
 * Shows business name, BCV exchange rate, and current user.
 * Adapts to desktop (inside main area) and mobile (full width).
 */

defineProps<{
  businessName?: string;
  exchangeRate?: number;
}>();
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
    </div>

    <!-- Exchange rate + user -->
    <div class="flex items-center gap-4">
      <span v-if="exchangeRate" class="text-xs text-gray-500">
        Bs.{{ exchangeRate.toFixed(2) }}
      </span>

      <!-- User badge placeholder (Phase 1: real auth) -->
      <button
        class="flex h-8 w-8 items-center justify-center rounded-full bg-nova-primary text-xs font-bold text-white"
      >
        P
      </button>
    </div>
  </header>
</template>
