<script setup lang="ts">
/**
 * Reports hub - links to all 7 pre-built reports.
 * Admin only. Each report has chart + table + AI narrative.
 */

definePageMeta({ middleware: ["admin-only"] });

const reportsList = [
  {
    to: "/reports/daily",
    icon: "📊",
    title: "Resumen del día",
    desc: "Ventas, comparativas, top productos",
  },
  {
    to: "/reports/weekly",
    icon: "📈",
    title: "Resumen semanal",
    desc: "Tendencias, mejor día, producto estrella",
  },
  {
    to: "/reports/cash-flow",
    icon: "💵",
    title: "Flujo de caja",
    desc: "Proyección 7 y 30 días, tendencia",
  },
  {
    to: "/reports/profitability",
    icon: "💰",
    title: "Rentabilidad",
    desc: "Margen, rotación, score por producto",
  },
  {
    to: "/reports/inventory",
    icon: "📦",
    title: "Movimiento inventario",
    desc: "Entradas, salidas, valorización",
  },
  {
    to: "/reports/receivable",
    icon: "🧾",
    title: "Cuentas por cobrar",
    desc: "Aging, top deudores",
  },
  {
    to: "/reports/sellers",
    icon: "👥",
    title: "Ventas por vendedor",
    desc: "Ranking, totales, ticket promedio",
  },
  {
    to: "/reports/financial",
    icon: "📋",
    title: "Resumen financiero",
    desc: "Ingresos, costos, ganancia (P&L)",
  },
  {
    to: "/reports/monthly-trend",
    icon: "📅",
    title: "Tendencia mensual",
    desc: "Ingresos por mes, ultimos 12 meses",
  },
];
</script>

<template>
  <div>
    <h1 class="mb-6 text-xl font-bold text-gray-900">Reportes</h1>

    <div class="grid gap-3 sm:grid-cols-2">
      <NuxtLink
        v-for="r in reportsList"
        :key="r.to"
        :to="r.to"
        class="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
      >
        <span class="text-3xl">{{ r.icon }}</span>
        <div>
          <p class="font-medium text-gray-900">{{ r.title }}</p>
          <p class="text-xs text-gray-500">{{ r.desc }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
