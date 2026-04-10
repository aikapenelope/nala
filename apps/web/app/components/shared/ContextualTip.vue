<script setup lang="ts">
/**
 * Contextual tip component for first-time users.
 * Shows once per section, dismissible, stored in localStorage.
 */

const props = defineProps<{
  tipId: string;
  title: string;
  description: string;
}>();

const dismissed = ref(true);

onMounted(() => {
  const key = `nova:tip:${props.tipId}`;
  dismissed.value = localStorage.getItem(key) === "true";
});

function dismiss() {
  localStorage.setItem(`nova:tip:${props.tipId}`, "true");
  dismissed.value = true;
}
</script>

<template>
  <div
    v-if="!dismissed"
    class="mb-4 flex items-start gap-3 rounded-xl bg-blue-50 p-4"
  >
    <span class="text-lg">💡</span>
    <div class="flex-1">
      <p class="text-sm font-medium text-blue-900">{{ title }}</p>
      <p class="mt-0.5 text-xs text-blue-700">{{ description }}</p>
    </div>
    <button
      class="text-xs text-blue-500 hover:text-blue-700"
      @click="dismiss"
    >
      Entendido
    </button>
  </div>
</template>
