<script setup lang="ts">
/**
 * Mobile bottom tab navigation.
 * 5 tabs: Inicio, Vender, Inventario, Clientes, Más.
 * Visible only on mobile (<768px).
 */

interface TabItem {
  to: string;
  icon: string;
  label: string;
}

const tabs: TabItem[] = [
  { to: "/", icon: "home", label: "Inicio" },
  { to: "/sales", icon: "shopping-cart", label: "Vender" },
  { to: "/inventory", icon: "package", label: "Inventario" },
  { to: "/clients", icon: "users", label: "Clientes" },
  { to: "/more", icon: "menu", label: "Más" },
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
      <span class="text-lg">{{ tab.icon }}</span>
      <span>{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>
