<script setup lang="ts">
/**
 * Employee performance widget.
 * Shown on the dashboard when an employee logs in via PIN.
 */

import { goalProgress } from "@nova/shared";

defineProps<{
  name: string;
  todaySales: number;
  todayCount: number;
  goalTarget: number;
  currentStreak: number;
  rank: number;
  totalSellers: number;
}>();
</script>

<template>
  <div class="rounded-xl bg-white p-5 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-gray-700">
        Tu rendimiento, {{ name }}
      </h2>
      <span
        v-if="currentStreak > 0"
        class="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700"
      >
        {{ currentStreak }} días racha
      </span>
    </div>

    <div class="mb-4 text-center">
      <p class="text-3xl font-bold text-gray-900">${{ todaySales.toFixed(2) }}</p>
      <p class="text-xs text-gray-500">{{ todayCount }} ventas hoy</p>
    </div>

    <div v-if="goalTarget > 0" class="mb-4">
      <div class="mb-1 flex items-center justify-between text-xs">
        <span class="text-gray-500">Meta del día</span>
        <span class="font-medium text-gray-700">
          ${{ todaySales.toFixed(0) }} / ${{ goalTarget.toFixed(0) }}
        </span>
      </div>
      <div class="h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          class="h-full rounded-full transition-all"
          :class="goalProgress(todaySales, goalTarget) >= 100 ? 'bg-green-500' : 'bg-nova-primary'"
          :style="{ width: `${goalProgress(todaySales, goalTarget)}%` }"
        />
      </div>
    </div>

    <div class="flex items-center justify-center gap-1 text-sm text-gray-500">
      <span class="font-semibold text-nova-primary">#{{ rank }}</span>
      <span>de {{ totalSellers }} vendedores</span>
    </div>
  </div>
</template>
