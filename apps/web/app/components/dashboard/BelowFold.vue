<script setup lang="ts">
/**
 * Dashboard below-the-fold content.
 *
 * Extracted as a lazy component so it's code-split from the initial bundle.
 * The dashboard first paints the hero + summary cards (above fold), then
 * this component loads asynchronously with the rest of the data.
 *
 * Nuxt auto-lazy-loads this when used as <LazyDashboardBelowFold />.
 */

import {
  TrendingUp,
  TrendingDown,
  BarChart3,
} from "lucide-vue-next";

interface PendingOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  total: number;
  paymentMethod: string;
  createdAt: string;
}

interface DueReceivable {
  id: string;
  customerName: string;
  customerPhone: string | null;
  balanceUsd: string;
  dueDate: string | null;
  createdAt?: string;
}

interface SmartAlert {
  id: string;
  icon: string;
  title: string;
  suggestion: string;
  actionLabel: string;
  actionTo: string;
  severity: "critical" | "warning" | "info";
}

interface FeedItem {
  id: string;
  icon: string;
  text: string;
  time: string;
  to?: string;
}

defineProps<{
  grossMargin: number;
  cashFlow7d: number;
  salesByMethod: Record<string, number>;
  todayCount: number;
  storeOnline: boolean | null;
  storeOrdersWeek: number;
  storeRevenueWeek: number;
  pendingOrders: PendingOrder[];
  pendingOrdersCount: number;
  dueToday: DueReceivable[];
  weeklyDays: Array<{ day: string; amount: number }>;
  activityFeed: FeedItem[];
  topProducts: Array<{ name: string; quantity: number }>;
  topProduct: { name: string; quantity: number } | null;
  dashboardAlerts: SmartAlert[];
  syncStatus: "online" | "offline" | "syncing";
  confirmingOrderId: string | null;
}>();

const emit = defineEmits<{
  confirmOrder: [orderId: string];
}>();

const methodLabel: Record<string, string> = {
  efectivo: "Efectivo",
  efectivo_usd: "Efectivo USD",
  pago_movil: "Pago Movil",
  binance: "Binance",
  zinli: "Zinli",
  transferencia: "Transferencia",
  zelle: "Zelle",
  fiado: "Fiado",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min}min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return new Date(dateStr).toLocaleDateString("es-VE", { timeZone: "America/Caracas", day: "numeric", month: "short" });
}
</script>

<template>
  <!-- FINANCIAL INSIGHTS: Margin + Cash Flow -->
  <div
    v-if="grossMargin > 0 || cashFlow7d !== 0"
    class="mt-2.5 grid grid-cols-2 gap-2"
  >
    <div
      v-if="grossMargin > 0"
      class="card-premium flex items-center gap-2.5 p-3"
    >
      <TrendingUp :size="14" class="flex-shrink-0 text-emerald-600" />
      <div class="min-w-0">
        <p class="text-[11px] font-bold text-gray-800">{{ grossMargin.toFixed(0) }}% margen</p>
        <p class="text-[10px] font-medium text-gray-400">Bruto este mes</p>
      </div>
    </div>

    <NuxtLink
      v-if="cashFlow7d !== 0"
      to="/reports"
      class="card-premium flex items-center gap-2.5 p-3 transition-spring"
    >
      <component
        :is="cashFlow7d >= 0 ? TrendingUp : TrendingDown"
        :size="14"
        :class="cashFlow7d >= 0 ? 'text-green-600' : 'text-red-500'"
        class="flex-shrink-0"
      />
      <div class="min-w-0">
        <p class="text-[11px] font-bold text-gray-800">
          {{ cashFlow7d >= 0 ? '+' : '' }}${{ cashFlow7d.toFixed(0) }}
        </p>
        <p class="text-[10px] font-medium text-gray-400">Flujo 7 dias</p>
      </div>
    </NuxtLink>
  </div>

  <!-- PAYMENT METHODS (mini breakdown) -->
  <div
    v-if="Object.keys(salesByMethod).length > 0 && todayCount > 0"
    class="mt-2 flex flex-wrap gap-1.5 px-0.5"
  >
    <span
      v-for="(amount, method) in salesByMethod"
      :key="method"
      class="rounded-lg bg-white/60 px-2 py-1 text-[10px] font-semibold text-gray-600"
    >
      {{ methodLabel[method as string] ?? method }} ${{ Number(amount).toFixed(0) }}
    </span>
  </div>

  <!-- STORE ONLINE STATUS -->
  <NuxtLink
    v-if="storeOnline !== null"
    to="/store"
    class="mt-2.5 flex items-center gap-3 rounded-[18px] bg-white/50 p-3.5 transition-spring"
  >
    <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100">
      <span
        class="h-2.5 w-2.5 rounded-full"
        :class="storeOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'"
      />
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-[12px] font-bold text-gray-800">
        Tienda {{ storeOnline ? "activa" : "inactiva" }}
      </p>
      <p v-if="storeOnline && storeOrdersWeek > 0" class="text-[10px] font-medium text-gray-500">
        {{ storeOrdersWeek }} pedidos · ${{ storeRevenueWeek.toFixed(0) }} esta semana
      </p>
    </div>
  </NuxtLink>

  <!-- PENDING ORDERS with quick confirm -->
  <div
    v-if="pendingOrders.length > 0"
    class="mt-3 rounded-[18px] border border-blue-200/60 bg-gradient-to-br from-[#EEF7FD] to-[#DBEAFE] p-3.5"
  >
    <div class="flex items-center justify-between">
      <p class="text-[11px] font-bold uppercase tracking-wider text-blue-700">
        Pedidos ({{ pendingOrders.length }})
      </p>
      <NuxtLink to="/orders" class="text-[10px] font-bold text-blue-600 hover:underline">
        Ver todo
      </NuxtLink>
    </div>
    <div class="mt-2 space-y-1.5">
      <div
        v-for="o in pendingOrders"
        :key="o.id"
        class="flex items-center justify-between gap-2 rounded-xl bg-white/60 px-3 py-2"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13px] font-bold text-gray-800">{{ o.customerName }}</p>
          <p class="text-[11px] text-gray-500">
            ${{ o.total.toFixed(2) }} · {{ methodLabel[o.paymentMethod] ?? o.paymentMethod }} · {{ timeAgo(o.createdAt) }}
          </p>
        </div>
        <button
          class="flex-shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-[10px] font-bold text-white transition-spring hover:bg-green-700 disabled:opacity-50"
          :disabled="confirmingOrderId === o.id"
          @click="emit('confirmOrder', o.id)"
        >
          {{ confirmingOrderId === o.id ? "..." : "Confirmar" }}
        </button>
      </div>
    </div>
  </div>

  <!-- COBROS PENDIENTES -->
  <div class="mt-3 rounded-[18px] border border-amber-200/60 bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] p-3.5">
    <div class="flex items-center justify-between">
      <p class="text-[11px] font-bold uppercase tracking-wider text-amber-700">
        Recordar pago {{ dueToday.length > 0 ? `(${dueToday.length})` : "" }}
      </p>
      <NuxtLink to="/accounts" class="text-[10px] font-bold text-amber-600 hover:underline">
        Ver todo
      </NuxtLink>
    </div>
    <div v-if="dueToday.length > 0" class="mt-2 space-y-1.5">
      <div
        v-for="d in dueToday"
        :key="d.id"
        class="flex items-center justify-between gap-2 rounded-xl bg-white/60 px-3 py-2"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13px] font-bold text-gray-800">{{ d.customerName }}</p>
          <p class="text-[11px] font-medium text-amber-700">${{ Number(d.balanceUsd).toFixed(2) }}</p>
        </div>
        <a
          v-if="d.customerPhone"
          :href="`https://wa.me/${d.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${d.customerName}, tienes un saldo pendiente de $${Number(d.balanceUsd).toFixed(2)}. ¿Cuando puedes realizar el pago? Gracias!`)}`"
          target="_blank"
          rel="noopener noreferrer"
          class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-green-600 text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
        </a>
      </div>
    </div>
    <p v-else class="mt-1.5 text-[11px] font-medium text-amber-600/70">
      No hay pagos pendientes por recordar
    </p>
  </div>

  <!-- WEEKLY CHART (compact) -->
  <NuxtLink
    v-if="weeklyDays.length > 0"
    to="/reports"
    class="card-premium mt-2.5 block p-3.5 transition-spring hover:shadow-[0_8px_20px_-5px_rgba(0,0,0,0.06)]"
  >
    <div class="mb-2 flex items-center justify-between">
      <p class="text-[11px] font-bold text-gray-500 tracking-wide">Ventas 7 dias</p>
      <BarChart3 :size="12" class="text-gray-400" />
    </div>
    <SharedBarChart
      :labels="weeklyDays.map((d) => d.day.slice(0, 2))"
      :data="weeklyDays.map((d) => d.amount)"
      :height="60"
    />
  </NuxtLink>

  <!-- ACTIVITY FEED -->
  <div
    v-if="activityFeed.length > 0"
    class="mt-2.5 rounded-[18px] bg-white/50 p-3.5"
  >
    <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
      Actividad reciente
    </p>
    <div class="space-y-1">
      <NuxtLink
        v-for="item in activityFeed"
        :key="item.id"
        :to="item.to ?? '#'"
        class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12px] transition-spring hover:bg-white/60"
      >
        <span class="flex-shrink-0">{{ item.icon }}</span>
        <span class="min-w-0 flex-1 truncate font-medium text-gray-700">{{ item.text }}</span>
        <span class="flex-shrink-0 text-[10px] font-medium text-gray-400">{{ item.time }}</span>
      </NuxtLink>
    </div>
  </div>

  <!-- TOP PRODUCTS TODAY -->
  <div
    v-if="topProducts.length > 0"
    class="mt-2.5 rounded-[18px] bg-white/50 p-3.5"
  >
    <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
      Mas vendidos hoy
    </p>
    <div class="space-y-1.5">
      <div
        v-for="(p, idx) in topProducts"
        :key="p.name"
        class="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
      >
        <span
          class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-extrabold"
          :class="idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'"
        >
          {{ idx + 1 }}
        </span>
        <span class="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-700">{{ p.name }}</span>
        <span class="flex-shrink-0 text-[11px] font-bold text-gray-500">{{ p.quantity }} uds</span>
      </div>
    </div>
  </div>

  <!-- SMART ALERTS -->
  <div
    v-if="dashboardAlerts.length > 0"
    class="mt-2.5 space-y-1.5"
  >
    <NuxtLink
      v-for="alert in dashboardAlerts"
      :key="alert.id"
      :to="alert.actionTo"
      class="flex items-start gap-2.5 rounded-[14px] bg-white/50 p-3 transition-spring hover:bg-white/70"
    >
      <span class="mt-0.5 flex-shrink-0 text-sm">{{ alert.icon }}</span>
      <div class="min-w-0 flex-1">
        <p class="text-[12px] font-bold text-gray-800">{{ alert.title }}</p>
        <p class="text-[10px] font-medium text-gray-400">{{ alert.suggestion }}</p>
      </div>
      <span
        class="flex-shrink-0 text-[10px] font-bold"
        :class="{
          'text-red-600': alert.severity === 'critical',
          'text-amber-600': alert.severity === 'warning',
          'text-blue-600': alert.severity === 'info',
        }"
      >
        {{ alert.actionLabel }}
      </span>
    </NuxtLink>
  </div>

  <!-- FOOTER: status -->
  <div class="mt-2.5 flex items-center justify-center gap-2 px-1">
    <span
      class="h-1.5 w-1.5 rounded-full"
      :class="{
        'bg-green-500': syncStatus === 'online',
        'bg-gray-400': syncStatus === 'offline',
        'bg-yellow-500 animate-pulse': syncStatus === 'syncing',
      }"
    />
    <span class="text-[10px] font-semibold text-gray-400">
      {{ syncStatus === "online" ? "Actualizado" : syncStatus === "syncing" ? "Sincronizando..." : "Offline" }}
    </span>
  </div>
</template>
