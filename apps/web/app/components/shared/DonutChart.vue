<script setup lang="ts">
/**
 * Reusable donut chart component using Chart.js via vue-chartjs.
 *
 * Usage:
 *   <SharedDonutChart :labels="['Efectivo','Movil']" :data="[60,40]" />
 */

import { Doughnut } from "vue-chartjs";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const props = withDefaults(
  defineProps<{
    labels: string[];
    data: number[];
    colors?: string[];
    height?: number;
  }>(),
  {
    colors: () => [
      "#4ade80",
      "#60a5fa",
      "#fbbf24",
      "#a78bfa",
      "#38bdf8",
      "#818cf8",
      "#fb923c",
    ],
    height: 160,
  },
);

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      data: props.data,
      backgroundColor: props.colors.slice(0, props.data.length),
      borderWidth: 2,
      borderColor: "#ffffff",
    },
  ],
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "60%",
  plugins: {
    legend: {
      position: "bottom" as const,
      labels: {
        font: { size: 10, weight: "bold" as const },
        color: "#6b7280",
        padding: 12,
        usePointStyle: true,
        pointStyleWidth: 8,
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx: { label: string; parsed: number }) =>
          `${ctx.label}: $${ctx.parsed.toFixed(2)}`,
      },
    },
  },
};
</script>

<template>
  <div :style="{ height: `${height}px` }">
    <Doughnut :data="chartData" :options="chartOptions" />
  </div>
</template>
