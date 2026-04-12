<script setup lang="ts">
/**
 * Mobile bottom tab navigation.
 * 5 tabs: Inicio, Vender, Inventario, Clientes, Mas.
 * Visible only on mobile (<768px).
 *
 * Uses Lucide Vue icons instead of text placeholders.
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
    class="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-200 bg-white"
  >
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-gray-500 transition-colors"
      active-class="text-nova-primary"
    >
      <component :is="tab.icon" :size="20" />
      <span>{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>
