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

const { user } = useNovaAuth();

interface SettingsSection {
  icon: Component;
  label: string;
  description: string;
  to: string;
}

const sections: SettingsSection[] = [
  {
    icon: Users,
    label: "Equipo",
    description: "Empleados, PINs, permisos",
    to: "/settings/team",
  },
  {
    icon: Store,
    label: "Negocio",
    description: "Email del contador, WhatsApp del negocio",
    to: "/settings/business",
  },
  {
    icon: ArrowLeftRight,
    label: "Tasa de cambio",
    description: "Configurar tasa BCV y EUR",
    to: "/settings/exchange-rate",
  },
  {
    icon: Tag,
    label: "Cargos adicionales",
    description: "Delivery, propinas, empaques",
    to: "/settings/surcharges",
  },
  {
    icon: Landmark,
    label: "Cuentas bancarias",
    description: "Bancos para referencia de pagos",
    to: "/settings/bank-accounts",
  },
  {
    icon: Bell,
    label: "Notificaciones",
    description: "Alertas diarias por email",
    to: "/settings/notifications",
  },
];
</script>

<template>
  <div>
    <h1 class="mb-2 text-xl font-bold text-gray-900">Configuracion</h1>
    <p class="mb-6 text-sm text-gray-500">
      {{ user?.name ?? "Admin" }} · Administrador
    </p>

    <div class="space-y-3">
      <NuxtLink
        v-for="section in sections"
        :key="section.label"
        :to="section.to"
        class="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm cursor-pointer hover:bg-gray-50"
      >
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100"
        >
          <component :is="section.icon" :size="20" class="text-gray-600" />
        </div>
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-900">{{ section.label }}</p>
          <p class="text-xs text-gray-500">{{ section.description }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
