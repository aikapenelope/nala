<script setup lang="ts">
/**
 * Empty state component for sections with no data yet.
 * Shows a friendly message and action button.
 */

defineProps<{
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <span v-if="icon" class="mb-3 text-4xl">{{ icon }}</span>
    <h3 class="text-lg font-semibold text-gray-900">{{ title }}</h3>
    <p class="mt-1 max-w-sm text-sm text-gray-500">{{ description }}</p>
    <NuxtLink
      v-if="actionLabel && actionTo"
      :to="actionTo"
      class="mt-4 rounded-lg bg-nova-primary px-4 py-2 text-sm font-medium text-white"
    >
      {{ actionLabel }}
    </NuxtLink>
  </div>
</template>
