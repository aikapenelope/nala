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
  Truck,
  Lock,
} from "lucide-vue-next";
import type { Component } from "vue";
import { LOCKED_ROUTES } from "~/utils/locked-routes";

const { user } = useNovaAuth();
const { isLocked, ensureInitialized } = useOwnerLock();

onMounted(() => { ensureInitialized(); });

function isRouteLocked(path: string): boolean {
  return isLocked.value && LOCKED_ROUTES.some(
    (r) => path === r || path.startsWith(r + "/"),
  );
}

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
    to: "/suppliers",
    icon: Truck,
    label: "Proveedores",
    description: "Directorio y deudas",
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
    <h1 class="mb-4 text-xl font-extrabold tracking-tight text-gradient">Mas</h1>

    <!-- Current user card -->
    <div class="card-premium mb-6 p-4">
      <div class="flex items-center gap-3">
        <span
          class="dark-pill flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold"
        >
          {{ user?.name?.charAt(0) ?? "?" }}
        </span>
        <div class="flex-1">
          <p class="font-semibold text-gray-800">
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
        class="card-premium card-lift flex items-center gap-4 p-4"
      >
        <div
          class="dark-pill flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
        >
          <component :is="item.icon" :size="18" class="text-white" />
        </div>
        <div class="flex-1">
          <p class="text-sm font-bold text-gray-800">{{ item.label }}</p>
          <p class="text-[11px] font-medium text-gray-500">{{ item.description }}</p>
        </div>
        <Lock v-if="isRouteLocked(item.to)" :size="14" class="flex-shrink-0 text-orange-400" />
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
        class="glass card-lift flex items-center gap-4 rounded-2xl p-3.5"
      >
        <div
          class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/60"
        >
          <component :is="item.icon" :size="16" class="text-gray-500" />
        </div>
        <div class="flex-1">
          <p class="text-[13px] font-semibold text-gray-700">{{ item.label }}</p>
          <p class="text-[11px] font-medium text-gray-400">{{ item.description }}</p>
        </div>
        <Lock v-if="isRouteLocked(item.to)" :size="14" class="flex-shrink-0 text-orange-400" />
      </NuxtLink>
    </div>
  </div>
</template>
