<script setup lang="ts">
/**
 * Settings hub page (owner only).
 *
 * Links to sub-sections:
 * - Team management (employees, PINs) -- available
 * - Business info (name, type, logo) -- coming soon
 * - Payment methods -- coming soon
 * - Exchange rate -- coming soon
 */

import { Store, Users, CreditCard, ArrowLeftRight } from "lucide-vue-next";
import type { Component } from "vue";

definePageMeta({ middleware: ["admin-only"] });

const { user } = useNovaAuth();

interface SettingsSection {
  icon: Component;
  label: string;
  description: string;
  to?: string;
  available: boolean;
}

const sections: SettingsSection[] = [
  {
    icon: Users,
    label: "Equipo",
    description: "Empleados, PINs, permisos",
    to: "/settings/team",
    available: true,
  },
  {
    icon: Store,
    label: "Negocio",
    description: "Email del contador, WhatsApp del negocio",
    to: "/settings/business",
    available: true,
  },
  {
    icon: CreditCard,
    label: "Metodos de pago",
    description: "Configurar metodos aceptados",
    available: false,
  },
  {
    icon: ArrowLeftRight,
    label: "Tasa de cambio",
    description: "Configurar tasa BCV y paralela",
    available: false,
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
      <component
        :is="section.to ? 'NuxtLink' : 'div'"
        v-for="section in sections"
        :key="section.label"
        :to="section.to"
        class="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm"
        :class="
          section.available ? 'cursor-pointer hover:bg-gray-50' : 'opacity-60'
        "
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
        <span
          v-if="!section.available"
          class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400"
        >
          Proximamente
        </span>
      </component>
    </div>
  </div>
</template>
