<script setup lang="ts">
/**
 * "More" page for mobile navigation.
 *
 * Provides access to sections not in the bottom tabs:
 * - Sales history
 * - Accounts (owner only)
 * - Day close (owner only)
 * - Reports (owner only)
 * - Accounting (owner only)
 * - Settings (owner only)
 *
 * Also shows the current user info and a logout option.
 */

import {
  History,
  Wallet,
  CalendarCheck,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  Truck,
  ClipboardList,
  DollarSign,
} from "lucide-vue-next";
import type { Component } from "vue";

const { isAdmin, user, fullLogout } = useNovaAuth();

interface MenuItem {
  to: string;
  icon: Component;
  label: string;
  description: string;
  adminOnly: boolean;
}

const menuItems: MenuItem[] = [
  {
    to: "/sales/history",
    icon: History,
    label: "Historial de ventas",
    description: "Ver todas las ventas realizadas",
    adminOnly: false,
  },
  {
    to: "/accounts",
    icon: Wallet,
    label: "Cuentas",
    description: "Por cobrar y por pagar",
    adminOnly: true,
  },
  {
    to: "/accounts/day-close",
    icon: CalendarCheck,
    label: "Cierre de caja",
    description: "Cuadre del dia",
    adminOnly: true,
  },
  {
    to: "/accounts/cash-opening",
    icon: DollarSign,
    label: "Apertura de caja",
    description: "Declarar efectivo al inicio",
    adminOnly: true,
  },
  {
    to: "/sales/quotations",
    icon: ClipboardList,
    label: "Cotizaciones",
    description: "Crear y convertir a venta",
    adminOnly: true,
  },
  {
    to: "/reports",
    icon: BarChart3,
    label: "Reportes",
    description: "Ventas, inventario, rentabilidad",
    adminOnly: true,
  },
  {
    to: "/accounting",
    icon: FileText,
    label: "Contabilidad",
    description: "Asientos y exportacion contable",
    adminOnly: true,
  },
  {
    to: "/suppliers",
    icon: Truck,
    label: "Proveedores",
    description: "Directorio y estado de cuenta",
    adminOnly: true,
  },
  {
    to: "/settings",
    icon: Settings,
    label: "Configuracion",
    description: "Negocio, empleados, preferencias",
    adminOnly: true,
  },
];

const visibleItems = computed(() =>
  menuItems.filter((item) => !item.adminOnly || isAdmin.value),
);

/** Logout and redirect to landing. */
async function handleLogout() {
  await fullLogout();
  navigateTo("/landing");
}
</script>

<template>
  <div>
    <h1 class="mb-4 text-xl font-bold text-gray-900">Mas</h1>

    <!-- Current user card -->
    <div class="mb-6 rounded-xl bg-white p-4 shadow-sm">
      <div class="flex items-center gap-3">
        <span
          class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
          :class="isAdmin ? 'bg-nova-primary' : 'bg-gray-400'"
        >
          {{ user?.name?.charAt(0) ?? "?" }}
        </span>
        <div class="flex-1">
          <p class="font-medium text-gray-900">
            {{ user?.name ?? "Sin usuario" }}
          </p>
          <p class="text-xs text-gray-500">
            {{ isAdmin ? "Dueno" : "Empleado" }}
          </p>
        </div>
      </div>

      <!-- Logout button -->
      <div class="mt-3">
        <button
          class="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-600"
          @click="handleLogout"
        >
          <LogOut :size="14" />
          Cerrar sesion
        </button>
      </div>
    </div>

    <!-- Menu items -->
    <div class="space-y-2">
      <NuxtLink
        v-for="item in visibleItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm transition-colors active:bg-gray-50"
      >
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100"
        >
          <component :is="item.icon" :size="20" class="text-gray-600" />
        </div>
        <div>
          <p class="text-sm font-medium text-gray-900">{{ item.label }}</p>
          <p class="text-xs text-gray-500">{{ item.description }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
