<script setup lang="ts">
/**
 * "More" page for mobile navigation.
 *
 * Organized in two sections:
 * - Main: core features not in bottom tabs (Tienda, Clientes, Historial, Config)
 * - Herramientas: advanced features (Cuentas, Cierre, Reportes, etc.)
 */

import {
  Globe,
  Users,
  History,
  Settings,
  Wallet,
  CalendarCheck,
  BarChart3,
  FileText,
  Receipt,
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

/** Core items - what most users need. */
const mainItems: MenuItem[] = [
  {
    to: "/store",
    icon: Globe,
    label: "Tienda Online",
    description: "Tu tienda publica PWA",
  },
  {
    to: "/clients",
    icon: Users,
    label: "Clientes",
    description: "Directorio y fiado",
  },
  {
    to: "/sales/history",
    icon: History,
    label: "Historial de ventas",
    description: "Todas las ventas realizadas",
  },
  {
    to: "/settings",
    icon: Settings,
    label: "Configuracion",
    description: "Negocio y preferencias",
  },
];

/** Advanced tools - for power users. */
const toolItems: MenuItem[] = [
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
    to: "/reports",
    icon: BarChart3,
    label: "Reportes",
    description: "Ventas, inventario, rentabilidad",
  },
  {
    to: "/accounting",
    icon: Receipt,
    label: "Gastos",
    description: "Registro de gastos y compras",
  },
  {
    to: "/accounting/ocr",
    icon: FileText,
    label: "OCR Factura",
    description: "Escanear factura con camara",
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

    <!-- Main items -->
    <div class="space-y-2">
      <NuxtLink
        v-for="item in mainItems"
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

    <!-- Tools section -->
    <p class="mb-2 mt-6 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
      Herramientas
    </p>
    <div class="space-y-2">
      <NuxtLink
        v-for="item in toolItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-4 rounded-xl bg-white/70 p-3.5 shadow-sm transition-all hover:shadow-md"
      >
        <div
          class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50"
        >
          <component :is="item.icon" :size="18" class="text-gray-400" />
        </div>
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-700">{{ item.label }}</p>
          <p class="text-[11px] text-gray-400">{{ item.description }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
