<script setup lang="ts">
/**
 * Desktop sidebar - simplified navigation.
 *
 * 7 core items always visible + collapsible "Herramientas" section
 * for advanced features (reports, accounting, suppliers, etc.).
 *
 * Expanded (w-60): logo + icon + label for each nav item.
 * Collapsed (w-16): icon-only with tooltip on hover.
 * Toggle button at the bottom. State persisted in localStorage.
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
  Receipt,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingBag,
  Globe,
  History,
  CalendarCheck,
  ChevronDown,
  Wrench,
  Truck,
} from "lucide-vue-next";
import type { Component } from "vue";

interface NavItem {
  to: string;
  icon: Component;
  label: string;
  badge?: boolean;
}

/** Core navigation - always visible. */
const coreItems: NavItem[] = [
  { to: "/", icon: Home, label: "Inicio" },
  { to: "/sales", icon: ShoppingCart, label: "Vender" },
  { to: "/orders", icon: ShoppingBag, label: "Pedidos", badge: true },
  { to: "/store", icon: Globe, label: "Tienda Online" },
  { to: "/inventory", icon: Package, label: "Inventario" },
  { to: "/clients", icon: Users, label: "Clientes" },
  { to: "/settings", icon: Settings, label: "Config." },
];

/** Advanced tools - collapsible section. */
const toolItems: NavItem[] = [
  { to: "/sales/history", icon: History, label: "Historial ventas" },
  { to: "/suppliers", icon: Truck, label: "Proveedores" },
  { to: "/accounts", icon: Wallet, label: "Cuentas" },
  { to: "/accounts/day-close", icon: CalendarCheck, label: "Cierre de caja" },
  { to: "/reports", icon: BarChart3, label: "Reportes" },
  { to: "/accounting", icon: Receipt, label: "Gastos" },
  { to: "/accounting/ocr", icon: FileText, label: "OCR Factura" },
];

const { user } = useNovaAuth();
const { pendingCount } = useOrdersBadge();

/** Sidebar collapsed state, persisted in localStorage. */
const isCollapsed = ref(false);

/** Tools section expanded state, persisted in localStorage. */
const toolsExpanded = ref(false);

onMounted(() => {
  if (import.meta.client) {
    isCollapsed.value = localStorage.getItem("nova:sidebar-collapsed") === "1";
    toolsExpanded.value = localStorage.getItem("nova:tools-expanded") === "1";
  }
});

function toggleCollapsed() {
  isCollapsed.value = !isCollapsed.value;
  if (import.meta.client) {
    localStorage.setItem(
      "nova:sidebar-collapsed",
      isCollapsed.value ? "1" : "0",
    );
  }
}

function toggleTools() {
  toolsExpanded.value = !toolsExpanded.value;
  if (import.meta.client) {
    localStorage.setItem(
      "nova:tools-expanded",
      toolsExpanded.value ? "1" : "0",
    );
  }
}
</script>

<template>
  <aside
    class="glass-strong flex h-full flex-col overflow-hidden rounded-3xl p-3 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
    :class="isCollapsed ? 'w-[68px]' : 'w-60'"
  >
    <!-- Logo -->
    <div
      class="mb-5 flex items-center gap-3 px-1.5 pt-1"
      :class="isCollapsed ? 'justify-center' : ''"
    >
      <div
        class="dark-pill flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
      >
        <span class="text-sm font-extrabold text-white">N</span>
      </div>
      <span v-if="!isCollapsed" class="text-xl font-extrabold text-gradient">
        novaincs
      </span>
    </div>

    <!-- Core navigation -->
    <nav class="flex-1 space-y-0.5">
      <NuxtLink
        v-for="item in coreItems"
        :key="item.to"
        :to="item.to"
        :title="isCollapsed ? item.label : undefined"
        class="group relative flex items-center rounded-2xl text-sm font-semibold text-gray-500 transition-spring hover:bg-white/60 hover:text-gray-900 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.05)]"
        :class="
          isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-4 py-2.5'
        "
        active-class="dark-pill !text-white !shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.15)]"
      >
        <component :is="item.icon" :size="18" class="flex-shrink-0" />
        <span v-if="!isCollapsed">{{ item.label }}</span>

        <!-- Pending orders badge -->
        <span
          v-if="item.badge && pendingCount > 0"
          class="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
          :class="isCollapsed ? 'absolute -top-1 -right-1' : ''"
        >
          {{ pendingCount }}
        </span>

        <!-- Tooltip on collapsed hover -->
        <span
          v-if="isCollapsed"
          class="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        >
          {{ item.label }}
        </span>
      </NuxtLink>

      <!-- Tools section divider -->
      <button
        v-if="!isCollapsed"
        class="mt-3 flex w-full items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 transition-colors hover:text-gray-600"
        @click="toggleTools"
      >
        <Wrench :size="12" />
        <span class="flex-1 text-left">Herramientas</span>
        <ChevronDown
          :size="12"
          class="transition-transform"
          :class="toolsExpanded ? 'rotate-180' : ''"
        />
      </button>
      <!-- Collapsed: just an icon -->
      <button
        v-else
        class="group relative mx-auto mt-3 flex items-center justify-center rounded-xl py-2 text-gray-400 transition-colors hover:text-gray-600"
        :title="toolsExpanded ? 'Ocultar herramientas' : 'Herramientas'"
        @click="toggleTools"
      >
        <Wrench :size="14" />
        <span
          class="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        >
          Herramientas
        </span>
      </button>

      <!-- Advanced tools (collapsible) -->
      <template v-if="toolsExpanded">
        <NuxtLink
          v-for="item in toolItems"
          :key="item.to"
          :to="item.to"
          :title="isCollapsed ? item.label : undefined"
          class="group relative flex items-center rounded-2xl text-sm font-semibold text-gray-400 transition-spring hover:bg-white/60 hover:text-gray-700 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.05)]"
          :class="
            isCollapsed ? 'justify-center px-0 py-2' : 'gap-3 px-4 py-2'
          "
          active-class="dark-pill !text-white !shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.15)]"
        >
          <component :is="item.icon" :size="16" class="flex-shrink-0" />
          <span v-if="!isCollapsed" class="text-[13px]">{{ item.label }}</span>

          <!-- Tooltip on collapsed hover -->
          <span
            v-if="isCollapsed"
            class="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
          >
            {{ item.label }}
          </span>
        </NuxtLink>
      </template>
    </nav>

    <!-- Collapse toggle -->
    <button
      class="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 transition-spring hover:bg-white/60 hover:text-gray-600"
      :title="isCollapsed ? 'Expandir' : 'Colapsar'"
      @click="toggleCollapsed"
    >
      <component
        :is="isCollapsed ? PanelLeftOpen : PanelLeftClose"
        :size="16"
      />
    </button>

    <!-- User section -->
    <div class="border-t border-white/50 px-1.5 pt-3">
      <div
        class="flex items-center rounded-2xl px-1.5 py-2 text-xs text-gray-500"
        :class="isCollapsed ? 'justify-center' : 'gap-3'"
      >
        <span
          class="dark-pill flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
        >
          {{ user?.name?.charAt(0) ?? "?" }}
        </span>
        <div v-if="!isCollapsed" class="min-w-0 flex-1">
          <p class="truncate font-semibold text-gray-700">
            {{ user?.name ?? "Sin usuario" }}
          </p>
        </div>
      </div>
    </div>
  </aside>
</template>
