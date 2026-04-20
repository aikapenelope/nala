<script setup lang="ts">
/**
 * Reports hub - links to all 9 pre-built reports.
 * Admin only. Each report has chart + table + AI narrative.
 */

import {
  BarChart3,
  TrendingUp,
  Wallet,
  PieChart,
  Package,
  FileText,
  Users,
  ClipboardList,
  Calendar,
} from "lucide-vue-next";
import type { Component } from "vue";

definePageMeta({ middleware: ["admin-only"] });

interface ReportItem {
  to: string;
  icon: Component;
  title: string;
  desc: string;
  gradient: string;
}

const reportsList: ReportItem[] = [
  {
    to: "/reports/daily",
    icon: BarChart3,
    title: "Resumen del dia",
    desc: "Ventas, comparativas, top productos",
    gradient: "from-[#EFECFF] to-[#D0CCF9]",
  },
  {
    to: "/reports/weekly",
    icon: TrendingUp,
    title: "Resumen semanal",
    desc: "Tendencias, mejor dia, producto estrella",
    gradient: "from-[#EEF7FD] to-[#CAE8F8]",
  },
  {
    to: "/reports/cash-flow",
    icon: Wallet,
    title: "Flujo de caja",
    desc: "Proyeccion 7 y 30 dias, tendencia",
    gradient: "from-[#F0FDF4] to-[#BBF7D0]",
  },
  {
    to: "/reports/profitability",
    icon: PieChart,
    title: "Rentabilidad",
    desc: "Margen, rotacion, score por producto",
    gradient: "from-[#FFF7ED] to-[#FED7AA]",
  },
  {
    to: "/reports/inventory",
    icon: Package,
    title: "Movimiento inventario",
    desc: "Entradas, salidas, valorizacion",
    gradient: "from-[#FEF2F2] to-[#FECACA]",
  },
  {
    to: "/reports/receivable",
    icon: FileText,
    title: "Cuentas por cobrar",
    desc: "Aging, top deudores",
    gradient: "from-[#FFFBEB] to-[#FDE68A]",
  },
  {
    to: "/reports/sellers",
    icon: Users,
    title: "Ventas por vendedor",
    desc: "Ranking, totales, ticket promedio",
    gradient: "from-[#F0F9FF] to-[#BAE6FD]",
  },
  {
    to: "/reports/financial",
    icon: ClipboardList,
    title: "Resumen financiero",
    desc: "Ingresos, costos, ganancia (P&L)",
    gradient: "from-[#FAF5FF] to-[#E9D5FF]",
  },
  {
    to: "/reports/monthly-trend",
    icon: Calendar,
    title: "Tendencia mensual",
    desc: "Ingresos por mes, ultimos 12 meses",
    gradient: "from-[#ECFDF5] to-[#A7F3D0]",
  },
];
</script>

<template>
  <div>
    <h1 class="mb-6 text-2xl font-extrabold tracking-tight text-gradient">Reportes</h1>

    <div class="grid gap-3 sm:grid-cols-2">
      <NuxtLink
        v-for="r in reportsList"
        :key="r.to"
        :to="r.to"
        class="card-lift relative flex items-center gap-4 overflow-hidden rounded-[20px] border border-white/80 p-4"
        :class="`bg-gradient-to-br ${r.gradient}`"
      >
        <div class="absolute -top-3 -right-3 h-12 w-12 rounded-full bg-white/30 blur-lg" />
        <div class="relative z-10 dark-pill flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px]">
          <component :is="r.icon" :size="18" class="text-white" />
        </div>
        <div class="relative z-10">
          <p class="font-bold text-gray-800">{{ r.title }}</p>
          <p class="text-xs font-medium text-gray-600/70">{{ r.desc }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
