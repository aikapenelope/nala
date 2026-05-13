<script setup lang="ts">
/**
 * Global toast notification container.
 *
 * Renders floating toast messages at the top-center of the viewport.
 * Must be mounted once in the app layout (e.g., default.vue).
 * Uses the glassmorphism design system for visual consistency.
 */

import { CheckCircle, XCircle, Info, X } from "lucide-vue-next";

const { toasts, dismiss } = useToast();

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
} as const;

const colorMap = {
  success: "text-green-600",
  error: "text-red-500",
  info: "text-gray-500",
} as const;
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-4"
    >
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="opacity-0 -translate-y-3 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 -translate-y-2 scale-95"
      >
        <div
          v-for="t in toasts"
          :key="t.id"
          class="pointer-events-auto glass-strong flex max-w-sm items-center gap-2.5 rounded-2xl px-4 py-3 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.15)]"
        >
          <component
            :is="iconMap[t.type]"
            :size="16"
            :class="colorMap[t.type]"
            class="flex-shrink-0"
          />
          <span class="flex-1 text-[13px] font-semibold text-gray-800">
            {{ t.message }}
          </span>
          <button
            class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:text-gray-500"
            @click="dismiss(t.id)"
          >
            <X :size="12" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
