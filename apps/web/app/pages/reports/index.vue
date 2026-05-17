<script setup lang="ts">
/**
 * Consolidated reports page with 3 tabs.
 *
 * Tab "Hoy": daily summary (sales, top products, payment methods)
 * Tab "Periodo": weekly/monthly trends, profitability, cash flow, sellers
 * Tab "Inventario": stock status, least-sold products, receivables aging
 *
 * Each tab lazy-loads its data on first activation.
 * Connected to: GET /api/reports/daily, weekly, profitability, inventory,
 *               receivable, sellers, cash-flow, financial, monthly-trend
 */

import {
  BarChart3,
  Package,
  Calendar,
  PackageX,
  Download,
} from "lucide-vue-next";

const { $api } = useApi();

// ============================================================
// Tab state
// ============================================================

type TabId = "hoy" | "periodo" | "inventario";
const activeTab = ref<TabId>("hoy");

const tabs: Array<{ id: TabId; label: string; icon: typeof BarChart3 }> = [
  { id: "hoy", label: "Hoy", icon: BarChart3 },
  { id: "periodo", label: "Periodo", icon: Calendar },
  { id: "inventario", label: "Inventario", icon: Package },
];

// ============================================================
// Tab: Hoy (daily summary)
// ============================================================

const hoyLoading = ref(false);
const hoyLoaded = ref(false);
const hoyData = ref({
  totalSales: 0,
  totalCount: 0,
  avgTicket: 0,
  vsPreviousDay: 0,
  topProducts: [] as Array<{ name: string; qty: number; total: number }>,
  salesByMethod: {} as Record<string, number>,
});

const methodLabels: Record<string, string> = {
  efectivo: "Efectivo",
  pago_movil: "Pago Movil",
  binance: "Binance",
  zinli: "Zinli",
  transferencia: "Transferencia",
  zelle: "Zelle",
  fiado: "Fiado",
};

const methodEntries = computed(() => {
  const entries = Object.entries(hoyData.value.salesByMethod);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return entries.map(([method, amount]) => ({
    method,
    amount,
    percent: total > 0 ? Math.round((amount / total) * 100) : 0,
  }));
});

async function fetchHoy() {
  if (hoyLoaded.value) return;
  hoyLoading.value = true;
  try {
    const result = await $api<{ data: typeof hoyData.value }>("/api/reports/daily?period=today");
    hoyData.value = result.data;
    hoyLoaded.value = true;
  } catch {
    /* empty state */
  } finally {
    hoyLoading.value = false;
  }
}

// ============================================================
// Tab: Periodo (weekly + trends)
// ============================================================

const periodoLoading = ref(false);
const periodoLoaded = ref(false);
const periodoPeriod = ref("week");

const periodoData = ref({
  totalSales: 0,
  totalCount: 0,
  vsPrevPeriod: 0,
  dailyBreakdown: [] as Array<{ day: string; amount: number }>,
  bestDay: null as string | null,
  topProduct: null as string | null,
});

async function fetchPeriodo() {
  periodoLoading.value = true;
  try {
    const result = await $api<{ data: typeof periodoData.value }>(
      `/api/reports/weekly?period=${periodoPeriod.value}`,
    );
    periodoData.value = result.data;
    periodoLoaded.value = true;
  } catch {
    /* empty state */
  } finally {
    periodoLoading.value = false;
  }
}

watch(periodoPeriod, fetchPeriodo);

// ============================================================
// Tab: Inventario (stock + receivables)
// ============================================================

const invLoading = ref(false);
const invLoaded = ref(false);

interface LeastSoldProduct {
  id: string;
  name: string;
  stock: number;
  price: number;
  daysSinceLastSale: number | null;
}

const invData = ref({
  totalProducts: 0,
  totalValue: 0,
  lowStock: 0,
  criticalStock: 0,
  deadStock: 0,
  leastSoldProducts: [] as LeastSoldProduct[],
});

async function fetchInventario() {
  if (invLoaded.value) return;
  invLoading.value = true;
  try {
    const result = await $api<{ data: typeof invData.value }>("/api/reports/inventory?period=today");
    invData.value = result.data;
    invLoaded.value = true;
  } catch {
    /* empty state */
  } finally {
    invLoading.value = false;
  }
}

function daysSinceLabel(days: number | null): string {
  if (days === null) return "Nunca vendido";
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} dias`;
}

// ============================================================
// Lazy-load on tab switch
// ============================================================

watch(activeTab, (tab) => {
  if (tab === "hoy") fetchHoy();
  else if (tab === "periodo") fetchPeriodo();
  else if (tab === "inventario") fetchInventario();
}, { immediate: true });

// ============================================================
// Export to Excel
// ============================================================

const isExporting = ref(false);

/** Download the current tab's data as an XLSX file. */
async function exportExcel() {
  isExporting.value = true;
  try {
    let endpoint = "";
    if (activeTab.value === "hoy") {
      endpoint = "/api/reports/daily/export-xlsx?period=today";
    } else if (activeTab.value === "periodo") {
      endpoint = `/api/reports/weekly/export-xlsx?period=${periodoPeriod.value}`;
    } else {
      // Inventory tab doesn't have an XLSX endpoint yet
      isExporting.value = false;
      return;
    }

    const blob = await $api<Blob>(endpoint, { responseType: "blob" as never });
    const url = URL.createObjectURL(blob as unknown as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-${activeTab.value}-${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // Non-critical: user can retry
  } finally {
    isExporting.value = false;
  }
}
</script>

<template>
  <div>
    <div class="mb-5 flex items-center justify-between">
      <h1 class="text-2xl font-extrabold tracking-tight text-gradient">Reportes</h1>
      <button
        v-if="activeTab !== 'inventario'"
        class="dark-pill flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-bold transition-spring disabled:opacity-50"
        :disabled="isExporting"
        @click="exportExcel"
      >
        <Download :size="14" />
        {{ isExporting ? "Exportando..." : "Excel" }}
      </button>
    </div>

    <!-- Tab selector -->
    <div class="mb-5 flex gap-1.5 rounded-2xl bg-white/40 p-1">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-spring"
        :class="
          activeTab === tab.id
            ? 'dark-pill text-white shadow-lg'
            : 'text-gray-500 hover:bg-white/60 hover:text-gray-700'
        "
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" :size="16" />
        {{ tab.label }}
      </button>
    </div>

    <!-- ============================================================ -->
    <!-- Tab: Hoy -->
    <!-- ============================================================ -->
    <div v-if="activeTab === 'hoy'">
      <div v-if="hoyLoading" class="py-12 text-center text-gray-400">Cargando...</div>
      <template v-else-if="hoyLoaded">
        <!-- KPI cards -->
        <div class="mb-4 grid grid-cols-4 gap-3">
          <div class="card-premium p-4 text-center">
            <p class="text-2xl font-extrabold text-gray-800">${{ hoyData.totalSales.toFixed(0) }}</p>
            <p class="text-[11px] font-bold text-gray-500">Ventas</p>
          </div>
          <div class="card-premium p-4 text-center">
            <p class="text-2xl font-extrabold text-gray-800">{{ hoyData.totalCount }}</p>
            <p class="text-[11px] font-bold text-gray-500">Transacciones</p>
          </div>
          <div class="card-premium p-4 text-center">
            <p
              class="text-2xl font-extrabold"
              :class="hoyData.vsPreviousDay >= 0 ? 'text-green-600' : 'text-red-600'"
            >
              {{ hoyData.vsPreviousDay >= 0 ? "+" : "" }}{{ hoyData.vsPreviousDay }}%
            </p>
            <p class="text-[11px] font-bold text-gray-500">vs ayer</p>
          </div>
          <div class="card-premium p-4 text-center">
            <p class="text-2xl font-extrabold text-gray-800">${{ hoyData.avgTicket.toFixed(2) }}</p>
            <p class="text-[11px] font-bold text-gray-500">Ticket prom.</p>
          </div>
        </div>

        <!-- Payment methods breakdown -->
        <div v-if="methodEntries.length > 0" class="card-premium mb-4 p-5">
          <h3 class="mb-3 text-sm font-semibold text-gray-700">Ventas por metodo</h3>
          <div class="space-y-2">
            <div v-for="m in methodEntries" :key="m.method" class="flex items-center gap-3">
              <span class="w-24 text-sm text-gray-600">{{ methodLabels[m.method] ?? m.method }}</span>
              <div class="h-4 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div class="h-full rounded-full bg-nova-primary" :style="{ width: `${m.percent}%` }" />
              </div>
              <span class="w-16 text-right text-sm font-medium text-gray-900">${{ m.amount.toFixed(0) }}</span>
            </div>
          </div>
        </div>

        <!-- Top products -->
        <div v-if="hoyData.topProducts.length > 0" class="card-premium overflow-hidden">
          <h3 class="px-5 pt-4 text-sm font-semibold text-gray-700">Top productos</h3>
          <table class="mt-2 w-full text-left text-sm">
            <thead class="border-b bg-gray-50">
              <tr>
                <th class="px-5 py-2 font-medium text-gray-500">#</th>
                <th class="px-5 py-2 font-medium text-gray-500">Producto</th>
                <th class="px-5 py-2 text-right font-medium text-gray-500">Cant.</th>
                <th class="px-5 py-2 text-right font-medium text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="(p, i) in hoyData.topProducts" :key="p.name">
                <td class="px-5 py-2 text-gray-400">{{ i + 1 }}</td>
                <td class="px-5 py-2 font-medium text-gray-900">{{ p.name }}</td>
                <td class="px-5 py-2 text-right text-gray-700">{{ p.qty }}</td>
                <td class="px-5 py-2 text-right text-gray-900">${{ p.total.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <!-- ============================================================ -->
    <!-- Tab: Periodo -->
    <!-- ============================================================ -->
    <div v-if="activeTab === 'periodo'">
      <!-- Period selector -->
      <div class="mb-4 flex gap-2">
        <button
          v-for="opt in [
            { value: 'week', label: 'Semana' },
            { value: 'month', label: 'Mes' },
            { value: 'last_month', label: 'Mes anterior' },
          ]"
          :key="opt.value"
          class="rounded-xl px-3.5 py-2 text-xs font-bold transition-spring"
          :class="
            periodoPeriod === opt.value
              ? 'dark-pill text-white'
              : 'bg-white/60 text-gray-600 hover:bg-white'
          "
          @click="periodoPeriod = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>

      <div v-if="periodoLoading" class="py-12 text-center text-gray-400">Cargando...</div>
      <template v-else-if="periodoLoaded">
        <div class="mb-4 grid grid-cols-3 gap-3">
          <div class="card-premium p-4 text-center">
            <p class="text-2xl font-extrabold text-gray-800">${{ periodoData.totalSales.toFixed(0) }}</p>
            <p class="text-[11px] font-bold text-gray-500">Total</p>
          </div>
          <div class="card-premium p-4 text-center">
            <p class="text-2xl font-extrabold text-gray-800">{{ periodoData.totalCount }}</p>
            <p class="text-[11px] font-bold text-gray-500">Ventas</p>
          </div>
          <div class="card-premium p-4 text-center">
            <p
              class="text-2xl font-extrabold"
              :class="periodoData.vsPrevPeriod >= 0 ? 'text-green-600' : 'text-red-600'"
            >
              {{ periodoData.vsPrevPeriod >= 0 ? "+" : "" }}{{ periodoData.vsPrevPeriod }}%
            </p>
            <p class="text-[11px] font-bold text-gray-500">vs anterior</p>
          </div>
        </div>

        <!-- Daily breakdown chart -->
        <div v-if="periodoData.dailyBreakdown.length > 0" class="card-premium p-5">
          <h3 class="mb-4 text-sm font-semibold text-gray-700">Desglose diario</h3>
          <SharedBarChart
            :labels="periodoData.dailyBreakdown.map((d) => d.day)"
            :data="periodoData.dailyBreakdown.map((d) => d.amount)"
            :height="140"
          />
        </div>

        <div v-if="periodoData.bestDay || periodoData.topProduct" class="mt-4 text-sm text-gray-500">
          <span v-if="periodoData.bestDay">Mejor dia: {{ periodoData.bestDay }}</span>
          <span v-if="periodoData.bestDay && periodoData.topProduct"> · </span>
          <span v-if="periodoData.topProduct">Producto estrella: {{ periodoData.topProduct }}</span>
        </div>
      </template>
    </div>

    <!-- ============================================================ -->
    <!-- Tab: Inventario -->
    <!-- ============================================================ -->
    <div v-if="activeTab === 'inventario'">
      <div v-if="invLoading" class="py-12 text-center text-gray-400">
        <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary" />
        Cargando...
      </div>
      <template v-else-if="invLoaded">
        <!-- Summary cards -->
        <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <div class="card-premium p-4 text-center">
            <p class="text-2xl font-extrabold text-gray-800">{{ invData.totalProducts }}</p>
            <p class="text-[11px] font-bold text-gray-500">Productos</p>
          </div>
          <div class="card-premium p-4 text-center">
            <p class="text-2xl font-extrabold text-gray-800">${{ invData.totalValue.toFixed(0) }}</p>
            <p class="text-[11px] font-bold text-gray-500">Valor total</p>
          </div>
          <div class="card-premium p-4 text-center">
            <p class="text-2xl font-extrabold text-stock-yellow">{{ invData.lowStock }}</p>
            <p class="text-[11px] font-bold text-gray-500">Stock bajo</p>
          </div>
          <div class="card-premium p-4 text-center">
            <p class="text-2xl font-extrabold text-stock-red">{{ invData.criticalStock }}</p>
            <p class="text-[11px] font-bold text-gray-500">Stock critico</p>
          </div>
          <div class="card-premium p-4 text-center">
            <p class="text-2xl font-extrabold text-stock-gray">{{ invData.deadStock }}</p>
            <p class="text-[11px] font-bold text-gray-500">Sin movimiento</p>
          </div>
        </div>

        <!-- Least-sold products -->
        <div v-if="invData.leastSoldProducts.length > 0" class="mt-4">
          <div class="mb-2.5 flex items-center gap-2 px-1">
            <PackageX :size="14" class="text-gray-400" />
            <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400">Menos vendidos</p>
          </div>
          <div class="card-premium overflow-hidden">
            <div
              v-for="(p, idx) in invData.leastSoldProducts"
              :key="p.id"
              class="flex items-center gap-3 px-4 py-3 transition-spring hover:bg-white/60"
              :class="{ 'border-t border-white/50': idx > 0 }"
            >
              <span
                class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold"
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
                :class="
                  p.daysSinceLastSale === null || p.daysSinceLastSale > 60
                    ? 'bg-red-50 text-red-600'
                    : p.daysSinceLastSale > 30
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-gray-100 text-gray-500'
                "
              >
                {{ daysSinceLabel(p.daysSinceLastSale) }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
