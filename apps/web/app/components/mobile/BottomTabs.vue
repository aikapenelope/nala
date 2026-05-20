<script setup lang="ts">
/**
 * Mobile bottom tabs - premium glass design.
 */

import { Home, ShoppingCart, Package, ShoppingBag, Menu } from "lucide-vue-next";
import type { Component } from "vue";

interface TabItem {
  to: string;
  icon: Component;
  label: string;
  badge?: boolean;
}

const tabs: TabItem[] = [
  { to: "/", icon: Home, label: "Inicio" },
  { to: "/sales", icon: ShoppingCart, label: "Vender" },
  { to: "/orders", icon: ShoppingBag, label: "Pedidos", badge: true },
  { to: "/inventory", icon: Package, label: "Inventario" },
  { to: "/more", icon: Menu, label: "Mas" },
];

const { pendingCount } = useOrdersBadge();
</script>

<template>
  <nav
    class="glass-strong fixed bottom-0 left-0 right-0 z-50 flex rounded-t-3xl pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.06)] will-change-transform"
  >
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="relative flex flex-1 flex-col items-center gap-0.5 py-3 text-[10px] font-semibold text-gray-400 transition-spring"
      active-class="!text-gray-900"
    >
      <component :is="tab.icon" :size="20" />
      <span>{{ tab.label }}</span>
      <!-- Badge -->
      <span
        v-if="tab.badge && pendingCount > 0"
        class="absolute top-1.5 right-1/4 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white"
      >
        {{ pendingCount }}
      </span>
    </NuxtLink>
  </nav>
</template>
