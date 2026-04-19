<script setup lang="ts">
/**
 * Desktop sidebar - premium glassmorphism design.
 *
 * Dark pill for active nav item, glass background,
 * spring animations on hover.
 */

import {
  Home,
  ShoppingCart,
  Package,
  Users,
  Wallet,
  BarChart3,
  FileText,
  Settings,
} from "lucide-vue-next";
import type { Component } from "vue";

interface NavItem {
  to: string;
  icon: Component;
  label: string;
  adminOnly: boolean;
}

const navItems: NavItem[] = [
  { to: "/", icon: Home, label: "Inicio", adminOnly: false },
  { to: "/sales", icon: ShoppingCart, label: "Vender", adminOnly: false },
  { to: "/inventory", icon: Package, label: "Inventario", adminOnly: false },
  { to: "/clients", icon: Users, label: "Clientes", adminOnly: false },
  { to: "/accounts", icon: Wallet, label: "Cuentas", adminOnly: true },
  { to: "/reports", icon: BarChart3, label: "Reportes", adminOnly: true },
  {
    to: "/accounting",
    icon: FileText,
    label: "Contabilidad",
    adminOnly: true,
  },
  { to: "/settings", icon: Settings, label: "Config.", adminOnly: true },
];

const { isAdmin, user } = useNovaAuth();

const visibleItems = computed(() =>
  navItems.filter((item) => !item.adminOnly || isAdmin.value),
);
</script>

<template>
  <aside class="glass-strong flex h-full w-60 flex-col rounded-3xl p-4">
    <!-- Logo -->
    <div class="mb-6 flex items-center gap-3 px-3 pt-2">
      <div
        class="dark-pill flex h-10 w-10 items-center justify-center rounded-xl"
      >
        <span class="text-sm font-extrabold text-white">N</span>
      </div>
      <span class="text-xl font-extrabold text-gradient">Nova</span>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 space-y-1">
      <NuxtLink
        v-for="item in visibleItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-500 transition-spring hover:bg-white/60 hover:text-gray-900 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.05)]"
        active-class="dark-pill !text-white !shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.15)]"
      >
        <component :is="item.icon" :size="18" class="flex-shrink-0" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <!-- User -->
    <div class="mt-auto border-t border-white/50 px-3 pt-4">
      <NuxtLink
        to="/auth/pin"
        class="flex items-center gap-3 rounded-2xl px-2 py-2 text-xs text-gray-500 transition-spring hover:bg-white/60"
      >
        <span
          class="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold text-white"
          :class="isAdmin ? 'dark-pill' : 'bg-gray-400'"
        >
          {{ user?.name?.charAt(0) ?? "?" }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold text-gray-700">
            {{ user?.name ?? "Sin usuario" }}
          </p>
          <p class="text-[10px] text-gray-400">
            {{ isAdmin ? "Administrador" : "Empleado" }}
          </p>
        </div>
      </NuxtLink>
    </div>
  </aside>
</template>
