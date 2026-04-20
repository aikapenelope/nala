<script setup lang="ts">
/**
 * Settings hub page (owner only).
 *
 * All sections link to functional pages.
 * Includes device mode toggle (owner vs store).
 */

import {
  Store,
  Users,
  ArrowLeftRight,
  Tag,
  Landmark,
  Bell,
  Monitor,
  Smartphone,
} from "lucide-vue-next";
import type { Component } from "vue";

definePageMeta({ middleware: ["admin-only"] });

const { user, clearUser } = useNovaAuth();
const { isStoreMode, activateStoreMode, deactivateStoreMode } = useDeviceMode();

/** Activate store mode and redirect to PIN screen. */
function enableStoreMode() {
  activateStoreMode();
  clearUser();
  navigateTo("/auth/pin");
}

/** Deactivate store mode (stays on settings page). */
function disableStoreMode() {
  deactivateStoreMode();
}

interface SettingsSection {
  icon: Component;
  label: string;
  description: string;
  to: string;
  gradient: string;
}

const sections: SettingsSection[] = [
  {
    icon: Users,
    label: "Equipo",
    description: "Empleados, PINs, permisos",
    to: "/settings/team",
    gradient: "from-[#EFECFF] to-[#D0CCF9]",
  },
  {
    icon: Store,
    label: "Negocio",
    description: "Email del contador, WhatsApp del negocio",
    to: "/settings/business",
    gradient: "from-[#EEF7FD] to-[#CAE8F8]",
  },
  {
    icon: ArrowLeftRight,
    label: "Tasa de cambio",
    description: "Configurar tasa BCV y EUR",
    to: "/settings/exchange-rate",
    gradient: "from-[#F0FDF4] to-[#BBF7D0]",
  },
  {
    icon: Tag,
    label: "Cargos adicionales",
    description: "Delivery, propinas, empaques",
    to: "/settings/surcharges",
    gradient: "from-[#FFF7ED] to-[#FED7AA]",
  },
  {
    icon: Landmark,
    label: "Cuentas bancarias",
    description: "Bancos para referencia de pagos",
    to: "/settings/bank-accounts",
    gradient: "from-[#FAF5FF] to-[#E9D5FF]",
  },
  {
    icon: Bell,
    label: "Notificaciones",
    description: "Alertas diarias por email",
    to: "/settings/notifications",
    gradient: "from-[#FFFBEB] to-[#FDE68A]",
  },
];
</script>

<template>
  <div>
    <h1 class="mb-1 text-2xl font-extrabold tracking-tight text-gradient">Configuracion</h1>
    <p class="mb-6 text-sm font-medium text-gray-500">
      {{ user?.name ?? "Admin" }} · Administrador
    </p>

    <!-- Device mode card -->
    <div class="card-premium mb-4 p-4">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" :class="isStoreMode ? 'bg-green-50' : 'bg-gray-100'">
          <component :is="isStoreMode ? Monitor : Smartphone" :size="18" :class="isStoreMode ? 'text-green-600' : 'text-gray-500'" />
        </div>
        <div class="flex-1">
          <p class="text-sm font-bold text-gray-800">
            {{ isStoreMode ? "Modo tienda" : "Modo personal" }}
          </p>
          <p class="text-[11px] font-medium text-gray-500">
            {{ isStoreMode
              ? "Este dispositivo es para empleados. Solo muestra PIN."
              : "Este es tu dispositivo personal. Siempre eres admin."
            }}
          </p>
        </div>
      </div>

      <div class="mt-3">
        <button
          v-if="!isStoreMode"
          class="w-full rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white transition-spring hover:bg-green-700"
          @click="enableStoreMode"
        >
          Activar modo tienda
        </button>
        <div v-else class="space-y-2">
          <p class="text-[11px] text-gray-400">
            Los empleados usan este dispositivo con su PIN. Tu tambien puedes entrar con tu PIN como admin.
          </p>
          <button
            class="w-full rounded-xl border border-gray-200 py-2 text-sm font-bold text-gray-600 transition-spring hover:bg-gray-50"
            @click="disableStoreMode"
          >
            Desactivar modo tienda
          </button>
        </div>
      </div>
    </div>

    <!-- How it works (only shown in owner mode) -->
    <div v-if="!isStoreMode" class="card-premium mb-4 p-4">
      <p class="mb-2 text-[11px] font-bold tracking-wider text-gray-400 uppercase">Como funciona</p>
      <div class="space-y-2 text-[12px] text-gray-600">
        <div class="flex gap-2">
          <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-nova-accent/10 text-[10px] font-bold text-nova-accent">1</span>
          <p><span class="font-bold text-gray-800">Tu telefono/PC</span> — Siempre eres admin. No necesitas PIN.</p>
        </div>
        <div class="flex gap-2">
          <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-nova-accent/10 text-[10px] font-bold text-nova-accent">2</span>
          <p><span class="font-bold text-gray-800">Tablet de la tienda</span> — Activa "Modo tienda" ahi. Los empleados entran con PIN.</p>
        </div>
        <div class="flex gap-2">
          <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-nova-accent/10 text-[10px] font-bold text-nova-accent">3</span>
          <p><span class="font-bold text-gray-800">Crea empleados</span> en Equipo y dales su PIN de 4 digitos.</p>
        </div>
      </div>
    </div>

    <div class="space-y-2.5">
      <NuxtLink
        v-for="section in sections"
        :key="section.label"
        :to="section.to"
        class="card-lift relative flex items-center gap-4 overflow-hidden rounded-[20px] border border-white/80 p-4"
        :class="`bg-gradient-to-br ${section.gradient}`"
      >
        <div class="absolute -top-3 -right-3 h-12 w-12 rounded-full bg-white/30 blur-lg" />
        <div
          class="relative z-10 dark-pill flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px]"
        >
          <component :is="section.icon" :size="18" class="text-white" />
        </div>
        <div class="relative z-10 flex-1">
          <p class="text-sm font-bold text-gray-800">{{ section.label }}</p>
          <p class="text-xs font-medium text-gray-600/70">{{ section.description }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
