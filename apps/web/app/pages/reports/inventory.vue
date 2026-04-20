<script setup lang="ts">
/**
 * Inventory status report.
 * Connected to: GET /api/reports/inventory
 */

import { PackageX } from "lucide-vue-next";

definePageMeta({ middleware: ["admin-only"] });
const { $api } = useApi();
const isLoading = ref(true);
const narrative = ref("");
const period = ref("today");

interface LeastSoldProduct {
  id: string;
  name: string;
  stock: number;
  price: number;
  daysSinceLastSale: number | null;
}

const data = ref({
  totalProducts: 0,
  totalValue: 0,
  lowStock: 0,
  criticalStock: 0,
  deadStock: 0,
  leastSoldProducts: [] as LeastSoldProduct[],
});

async function fetchReport() {
  isLoading.value = true;
  try {
    const result = await $api<{ data: typeof data.value; narrative: string }>(
      `/api/reports/inventory?period=${period.value}`,
    );
    data.value = result.data;
    narrative.value = result.narrative;
  } catch {
    /* empty state */
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchReport);
watch(period, fetchReport);

function daysSinceLabel(days: number | null): string {
  if (days === null) return "Nunca vendido";
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} dias`;
}
</script>
<template>
  <SharedReportLayout
    v-model="period"
    title="Inventario"
    :narrative="narrative"
  >
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary" />
      Cargando...
    </div>
    <template v-else>
      <!-- Summary cards -->
      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <div class="card-premium p-4 text-center">
          <p class="text-2xl font-extrabold text-gray-800">
            {{ data.totalProducts }}
          </p>
          <p class="text-[11px] font-bold text-gray-500">Productos</p>
        </div>
        <div class="card-premium p-4 text-center">
          <p class="text-2xl font-extrabold text-gray-800">
            ${{ data.totalValue.toFixed(0) }}
          </p>
          <p class="text-[11px] font-bold text-gray-500">Valor total</p>
        </div>
        <div class="card-premium p-4 text-center">
          <p class="text-2xl font-extrabold text-stock-yellow">
            {{ data.lowStock }}
          </p>
          <p class="text-[11px] font-bold text-gray-500">Stock bajo</p>
        </div>
        <div class="card-premium p-4 text-center">
          <p class="text-2xl font-extrabold text-stock-red">
            {{ data.criticalStock }}
          </p>
          <p class="text-[11px] font-bold text-gray-500">Stock critico</p>
        </div>
        <div class="card-premium p-4 text-center">
          <p class="text-2xl font-extrabold text-stock-gray">{{ data.deadStock }}</p>
          <p class="text-[11px] font-bold text-gray-500">Sin movimiento</p>
        </div>
      </div>

      <!-- Least-sold products ranking -->
      <div v-if="data.leastSoldProducts.length > 0" class="mt-4">
        <div class="mb-2.5 flex items-center gap-2 px-1">
          <PackageX :size="14" class="text-gray-400" />
          <p class="text-[11px] font-bold tracking-wider text-gray-400 uppercase">Menos vendidos</p>
        </div>
        <div class="card-premium overflow-hidden">
          <div
            v-for="(p, idx) in data.leastSoldProducts"
            :key="p.id"
            class="flex items-center gap-3 px-4 py-3 transition-spring hover:bg-white/60"
            :class="{ 'border-t border-white/50': idx > 0 }"
          >
            <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold"
              :class="idx < 3 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'"
            >
              {{ idx + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[13px] font-semibold text-gray-800">{{ p.name }}</p>
              <p class="text-[10px] font-medium text-gray-500">
                {{ p.stock }} en stock · ${{ p.price.toFixed(2) }}
              </p>
            </div>
            <span
              class="flex-shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold"
              :class="p.daysSinceLastSale === null || p.daysSinceLastSale > 60
                ? 'bg-red-50 text-red-600'
                : p.daysSinceLastSale > 30
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-gray-100 text-gray-500'"
            >
              {{ daysSinceLabel(p.daysSinceLastSale) }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </SharedReportLayout>
</template>
