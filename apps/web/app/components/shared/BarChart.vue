<script setup lang="ts">
/**
 * Reusable bar chart component using Chart.js via vue-chartjs.
 *
 * Usage:
 *   <SharedBarChart :labels="['Lun','Mar']" :data="[100,200]" />
 */

import { Bar } from "vue-chartjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const props = withDefaults(
  defineProps<{
    labels: string[];
    data: number[];
    color?: string;
    height?: number;
  }>(),
  {
    color: "#7c3aed",
    height: 160,
  },
);

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      data: props.data,
      backgroundColor: props.color + "40",
      borderColor: props.color,
      borderWidth: 1.5,
      borderRadius: 6,
      barPercentage: 0.7,
    },
  ],
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      callbacks: {
        label: (ctx: { parsed: { y: number } }) =>
          `$${ctx.parsed.y.toFixed(2)}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 10, weight: "bold" as const }, color: "#9ca3af" },
    },
    y: {
      grid: { color: "#f3f4f6" },
      ticks: {
        font: { size: 9 },
        color: "#9ca3af",
        callback: (v: string | number) => `$${Number(v).toFixed(0)}`,
      },
    },
  },
};
</script>

<template>
  <div :style="{ height: `${height}px` }">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
