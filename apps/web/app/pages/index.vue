<script setup lang="ts">
/**
 * Dashboard / Home page.
 * Phase 0: Placeholder with basic structure.
 * Phase 5: Full progressive disclosure dashboard.
 */

const { isMobile } = useDevice();
</script>

<template>
  <div>
    <!-- Main metric -->
    <div class="rounded-xl bg-white p-6 text-center shadow-sm">
      <p class="text-4xl font-bold text-gray-900">$0.00</p>
      <p class="mt-1 text-sm text-gray-500">vendidos hoy</p>
    </div>

    <!-- Summary cards -->
    <div class="mt-4 grid gap-4" :class="isMobile ? 'grid-cols-2' : 'grid-cols-3'">
      <div class="rounded-xl bg-white p-4 shadow-sm">
        <p class="text-lg font-semibold text-gray-900">$0</p>
        <p class="text-xs text-gray-500">por cobrar</p>
      </div>
      <div class="rounded-xl bg-white p-4 shadow-sm">
        <p class="text-lg font-semibold text-gray-900">0</p>
        <p class="text-xs text-gray-500">stock bajo</p>
      </div>
      <div v-if="!isMobile" class="rounded-xl bg-white p-4 shadow-sm">
        <p class="text-lg font-semibold text-gray-900">$0</p>
        <p class="text-xs text-gray-500">este mes</p>
      </div>
    </div>

    <!-- Mobile: quick action button -->
    <div v-if="isMobile" class="mt-6">
      <button
        class="w-full rounded-xl bg-nova-primary py-3 text-center font-semibold text-white"
      >
        + Nueva venta
      </button>
    </div>
  </div>
</template>
