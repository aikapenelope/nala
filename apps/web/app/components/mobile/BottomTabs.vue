<script setup lang="ts">
/**
 * Mobile bottom tabs - premium glass design.
 */

import { Home, ShoppingCart, Package, Users, Menu } from "lucide-vue-next";
import type { Component } from "vue";

interface TabItem {
  to: string;
  icon: Component;
  label: string;
}

const tabs: TabItem[] = [
  { to: "/", icon: Home, label: "Inicio" },
  { to: "/sales", icon: ShoppingCart, label: "Vender" },
  { to: "/inventory", icon: Package, label: "Inventario" },
  { to: "/clients", icon: Users, label: "Clientes" },
  { to: "/more", icon: Menu, label: "Mas" },
];
</script>

<template>
  <nav
    class="glass-strong fixed bottom-0 left-0 right-0 z-50 flex rounded-t-3xl shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.06)]"
  >
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="flex flex-1 flex-col items-center gap-0.5 py-3 text-[10px] font-semibold text-gray-400 transition-spring"
      active-class="!text-gray-900"
    >
      <component :is="tab.icon" :size="20" />
      <span>{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>
