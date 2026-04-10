<script setup lang="ts">
/**
 * Default layout with responsive design.
 *
 * Desktop (>1025px): Sidebar left + header + main content area.
 * Mobile (<768px): Header + main content + bottom tabs.
 *
 * Based on the Square/Shopify pattern:
 * - Desktop = center of analysis and configuration
 * - Mobile = center of action and data capture
 */

const { isDesktop } = useDevice();
</script>

<template>
  <!-- Desktop layout: sidebar + main -->
  <div v-if="isDesktop" class="flex h-screen">
    <DesktopSidebar />
    <div class="flex flex-1 flex-col overflow-hidden">
      <SharedAppHeader business-name="Nova" />
      <main class="flex-1 overflow-y-auto bg-gray-50 p-6">
        <slot />
      </main>
    </div>
  </div>

  <!-- Mobile layout: header + content + bottom tabs -->
  <div v-else class="flex min-h-screen flex-col">
    <SharedAppHeader business-name="Nova" />
    <main class="flex-1 bg-gray-50 p-4 pb-20">
      <slot />
    </main>
    <MobileBottomTabs />
  </div>
</template>
