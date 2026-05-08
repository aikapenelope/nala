<script setup lang="ts">
/**
 * "More" page for mobile navigation.
 *
 * Provides access to sections not in the bottom tabs.
 * Logout is handled by the Clerk UserButton in the header.
 */

import {
  History,
  Wallet,
  CalendarCheck,
  BarChart3,
  FileText,
  Settings,
  Truck,
  ClipboardList,
  DollarSign,
} from "lucide-vue-next";
import type { Component } from "vue";

const { user } = useNovaAuth();

interface MenuItem {
  to: string;
  icon: Component;
  label: string;
  description: string;
}

const menuItems: MenuItem[] = [
  {
    to: "/sales/history",
    icon: History,
    label: "Historial de ventas",
    description: "Ver todas las ventas realizadas",
  },
  {
    to: "/accounts",
    icon: Wallet,
    label: "Cuentas",
    description: "Por cobrar y por pagar",
  },
  {
    to: "/accounts/day-close",
    icon: CalendarCheck,
    label: "Cierre de caja",
    description: "Cuadre del dia",
  },
  {
    to: "/accounts/cash-opening",
    icon: DollarSign,
    label: "Apertura de caja",
    description: "Declarar efectivo al inicio",
  },
  {
    to: "/sales/quotations",
    icon: ClipboardList,
    label: "Cotizaciones",
    description: "Crear y convertir a venta",
  },
  {
    to: "/reports",
    icon: BarChart3,
    label: "Reportes",
    description: "Ventas, inventario, rentabilidad",
  },
  {
    to: "/accounting",
    icon: FileText,
    label: "Contabilidad",
    description: "Asientos y exportacion contable",
  },
  {
    to: "/suppliers",
    icon: Truck,
    label: "Proveedores",
    description: "Directorio y estado de cuenta",
  },
  {
    to: "/settings",
    icon: Settings,
    label: "Configuracion",
    description: "Negocio y preferencias",
  },
];
</script>

<template>
  <div>
    <h1 class="mb-4 text-xl font-bold text-gray-900">Mas</h1>

    <!-- Current user card -->
    <div class="mb-6 rounded-xl bg-white p-4 shadow-sm">
      <div class="flex items-center gap-3">
        <span
          class="flex h-10 w-10 items-center justify-center rounded-full bg-nova-primary text-sm font-bold text-white"
        >
          {{ user?.name?.charAt(0) ?? "?" }}
        </span>
        <div class="flex-1">
          <p class="font-medium text-gray-900">
            {{ user?.name ?? "Sin usuario" }}
          </p>
        </div>
      </div>
    </div>

    <!-- Menu items -->
    <div class="space-y-2">
      <NuxtLink
        v-for="item in menuItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm transition-all hover:shadow-md"
      >
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100"
        >
          <component :is="item.icon" :size="20" class="text-gray-600" />
        </div>
        <div class="flex-1">
          <p class="text-sm font-semibold text-gray-900">{{ item.label }}</p>
          <p class="text-xs text-gray-500">{{ item.description }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
