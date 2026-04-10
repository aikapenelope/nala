<script setup lang="ts">
/**
 * Desktop sidebar navigation.
 * Shows all sections for admin, restricted set for employees.
 * Visible only on desktop (>1025px).
 */

interface NavItem {
  to: string;
  icon: string;
  label: string;
  adminOnly: boolean;
}

const navItems: NavItem[] = [
  { to: "/", icon: "home", label: "Inicio", adminOnly: false },
  { to: "/sales", icon: "shopping-cart", label: "Vender", adminOnly: false },
  {
    to: "/inventory",
    icon: "package",
    label: "Inventario",
    adminOnly: false,
  },
  { to: "/clients", icon: "users", label: "Clientes", adminOnly: false },
  { to: "/accounts", icon: "wallet", label: "Cuentas", adminOnly: true },
  { to: "/reports", icon: "bar-chart", label: "Reportes", adminOnly: true },
  {
    to: "/accounting",
    icon: "file-text",
    label: "Contabilidad",
    adminOnly: true,
  },
  { to: "/settings", icon: "settings", label: "Config.", adminOnly: true },
];

// TODO: Replace with real auth composable in Phase 1
const isAdmin = ref(true);

const visibleItems = computed(() =>
  navItems.filter((item) => !item.adminOnly || isAdmin.value),
);
</script>

<template>
  <aside
    class="flex h-screen w-56 flex-col border-r border-gray-200 bg-white"
  >
    <!-- Logo -->
    <div class="flex h-16 items-center px-6">
      <span class="text-xl font-bold text-nova-primary">Nova</span>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 space-y-1 px-3 py-4">
      <NuxtLink
        v-for="item in visibleItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-nova-primary"
        active-class="bg-blue-50 text-nova-primary"
      >
        <span class="text-base">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <!-- Sync status -->
    <div class="border-t border-gray-200 px-4 py-3">
      <div class="flex items-center gap-2 text-xs text-gray-500">
        <span class="h-2 w-2 rounded-full bg-green-500" />
        <span>Conectado</span>
      </div>
    </div>
  </aside>
</template>
