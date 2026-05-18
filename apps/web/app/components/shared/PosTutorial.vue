<script setup lang="ts">
/**
 * POS Tutorial overlay — highlights UI elements step by step.
 *
 * Uses a semi-transparent backdrop with a "spotlight" cutout
 * around the target element. A tooltip explains each step.
 *
 * Lightweight: no external dependencies, pure CSS + JS positioning.
 */

import { X } from "lucide-vue-next";

const props = defineProps<{
  isActive: boolean;
  step: {
    target: string;
    title: string;
    description: string;
    position: "top" | "bottom" | "left" | "right";
  } | null;
  progress: { current: number; total: number };
}>();

const emit = defineEmits<{
  next: [];
  skip: [];
}>();

/** Position of the tooltip. */
const tooltipStyle = ref<Record<string, string>>({});
const spotlightStyle = ref<Record<string, string>>({});

/** Recalculate position when step changes. */
watch(
  () => props.step,
  async () => {
    if (!props.step || !import.meta.client) return;
    await nextTick();
    // Small delay to let DOM settle after step change
    setTimeout(positionTooltip, 50);
  },
  { immediate: true },
);

function positionTooltip() {
  if (!props.step || !import.meta.client) return;

  const el = document.querySelector(props.step.target);
  if (!el) {
    // Target not found — position center
    tooltipStyle.value = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
    spotlightStyle.value = { display: "none" };
    return;
  }

  const rect = el.getBoundingClientRect();
  const padding = 8;

  // Spotlight around target
  spotlightStyle.value = {
    top: `${rect.top - padding}px`,
    left: `${rect.left - padding}px`,
    width: `${rect.width + padding * 2}px`,
    height: `${rect.height + padding * 2}px`,
  };

  // Tooltip position
  const pos = props.step.position;
  if (pos === "bottom") {
    tooltipStyle.value = {
      top: `${rect.bottom + 16}px`,
      left: `${rect.left + rect.width / 2}px`,
      transform: "translateX(-50%)",
    };
  } else if (pos === "top") {
    tooltipStyle.value = {
      bottom: `${window.innerHeight - rect.top + 16}px`,
      left: `${rect.left + rect.width / 2}px`,
      transform: "translateX(-50%)",
    };
  } else if (pos === "left") {
    tooltipStyle.value = {
      top: `${rect.top + rect.height / 2}px`,
      right: `${window.innerWidth - rect.left + 16}px`,
      transform: "translateY(-50%)",
    };
  } else {
    tooltipStyle.value = {
      top: `${rect.top + rect.height / 2}px`,
      left: `${rect.right + 16}px`,
      transform: "translateY(-50%)",
    };
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isActive && step"
      class="fixed inset-0 z-[100]"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50 transition-opacity" />

      <!-- Spotlight cutout -->
      <div
        class="absolute rounded-2xl ring-4 ring-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] transition-all duration-300"
        :style="spotlightStyle"
      />

      <!-- Tooltip -->
      <div
        class="absolute z-[101] w-72 rounded-2xl bg-white p-5 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)]"
        :style="tooltipStyle"
      >
        <!-- Close button -->
        <button
          class="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          @click="emit('skip')"
        >
          <X :size="16" />
        </button>

        <p class="text-sm font-extrabold text-gray-900">{{ step.title }}</p>
        <p class="mt-1.5 text-xs leading-relaxed text-gray-600">{{ step.description }}</p>

        <!-- Progress + actions -->
        <div class="mt-4 flex items-center justify-between">
          <span class="text-[11px] font-medium text-gray-400">
            {{ progress.current }} de {{ progress.total }}
          </span>
          <div class="flex gap-2">
            <button
              class="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
              @click="emit('skip')"
            >
              Saltar
            </button>
            <button
              class="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-gray-800"
              @click="emit('next')"
            >
              {{ progress.current === progress.total ? "Listo" : "Siguiente" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
