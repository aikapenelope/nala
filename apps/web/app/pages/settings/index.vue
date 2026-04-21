<script setup lang="ts">
/**
 * Settings hub page (owner only).
 *
 * All sections link to functional pages.
 */

import {
  Store,
  Users,
  ArrowLeftRight,
  Tag,
  Landmark,
  Bell,
} from "lucide-vue-next";
import type { Component } from "vue";

definePageMeta({ middleware: ["admin-only"] });

const { user, fullLogout } = useNovaAuth();

/** Full logout: clear everything and redirect to landing. */
async function handleFullLogout() {
  await fullLogout();
  navigateTo("/landing");
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
    description: "Empleados y links de acceso",
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
    <h1 class="mb-1 text-2xl font-extrabold tracking-tight text-gradient">
      Configuracion
    </h1>
    <p class="mb-6 text-sm font-medium text-gray-500">
      {{ user?.name ?? "Admin" }} · Administrador
    </p>

    <div class="space-y-2.5">
      <NuxtLink
        v-for="section in sections"
        :key="section.label"
        :to="section.to"
        class="card-lift relative flex items-center gap-4 overflow-hidden rounded-[20px] border border-white/80 p-4"
        :class="`bg-gradient-to-br ${section.gradient}`"
      >
        <div
          class="absolute -top-3 -right-3 h-12 w-12 rounded-full bg-white/30 blur-lg"
        />
        <div
          class="relative z-10 dark-pill flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px]"
        >
          <component :is="section.icon" :size="18" class="text-white" />
        </div>
        <div class="relative z-10 flex-1">
          <p class="text-sm font-bold text-gray-800">{{ section.label }}</p>
          <p class="text-xs font-medium text-gray-600/70">
            {{ section.description }}
          </p>
        </div>
      </NuxtLink>
    </div>

    <!-- Full logout -->
    <div class="mt-6 px-1">
      <button
        class="w-full rounded-xl border border-red-200 py-2.5 text-sm font-bold text-red-500 transition-spring hover:bg-red-50"
        @click="handleFullLogout"
      >
        Cerrar sesion
      </button>
      <p class="mt-1.5 text-center text-[10px] text-gray-400">
        Cierra tu sesion en este dispositivo.
      </p>
    </div>
  </div>
</template>
