<script setup lang="ts">
/**
 * Sales by seller report + gamification (goals, streaks, rankings).
 *
 * Connected to:
 * - GET /api/reports/sellers?period=week (period report)
 * - GET /api/reports/gamification (today's goals and streaks)
 */
definePageMeta({ middleware: ["admin-only"] });
const { $api } = useApi();
const isLoading = ref(true);
const narrative = ref("");
const period = ref("week");
const sellers = ref<
  Array<{ name: string; sales: number; total: number; avgTicket: number }>
>([]);

/** Gamification data. */
interface GamSeller {
  name: string;
  rank: number;
  totalUsd: number;
  salesCount: number;
  goalPercent: number;
  goalTarget: number;
  currentStreak: number;
  bestStreak: number;
}
const gamSellers = ref<GamSeller[]>([]);
const dailyGoal = ref(100);
const gamLoading = ref(true);

async function fetchReport() {
  isLoading.value = true;
  try {
    const result = await $api<{
      data: { sellers: typeof sellers.value };
      narrative: string;
    }>(`/api/reports/sellers?period=${period.value}`);
    sellers.value = result.data.sellers;
    narrative.value = result.narrative;
  } catch {
    /* empty state */
  } finally {
    isLoading.value = false;
  }
}

async function fetchGamification() {
  gamLoading.value = true;
  try {
    const result = await $api<{
      sellers: GamSeller[];
      dailyGoal: number;
    }>("/api/reports/gamification");
    gamSellers.value = result.sellers;
    dailyGoal.value = result.dailyGoal;
  } catch {
    /* non-critical */
  } finally {
    gamLoading.value = false;
  }
}

onMounted(() => {
  fetchReport();
  fetchGamification();
});
watch(period, fetchReport);
</script>
<template>
  <SharedReportLayout
    v-model="period"
    title="Ventas por vendedor"
    :narrative="narrative"
  >
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando...
    </div>
    <div
      v-else-if="sellers.length === 0"
      class="py-12 text-center text-gray-400"
    >
      Sin datos de vendedores
    </div>
    <div v-else class="overflow-hidden rounded-xl bg-white shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-gray-50">
          <tr>
            <th class="px-4 py-3 font-medium text-gray-500">#</th>
            <th class="px-4 py-3 font-medium text-gray-500">Vendedor</th>
            <th class="px-4 py-3 text-right font-medium text-gray-500">
              Ventas
            </th>
            <th class="px-4 py-3 text-right font-medium text-gray-500">
              Total
            </th>
            <th class="px-4 py-3 text-right font-medium text-gray-500">
              Ticket prom.
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="(s, i) in sellers" :key="s.name">
            <td class="px-4 py-3 text-gray-400">{{ i + 1 }}</td>
            <td class="px-4 py-3 font-medium text-gray-900">{{ s.name }}</td>
            <td class="px-4 py-3 text-right text-gray-700">{{ s.sales }}</td>
            <td class="px-4 py-3 text-right font-medium text-gray-900">
              ${{ s.total.toFixed(2) }}
            </td>
            <td class="px-4 py-3 text-right text-gray-500">
              ${{ s.avgTicket.toFixed(2) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Gamification: Today's goals and streaks -->
    <div v-if="!gamLoading && gamSellers.length > 0" class="mt-6">
      <h2 class="mb-3 text-sm font-semibold text-gray-700">
        Meta del dia · ${{ dailyGoal }}
      </h2>
      <div class="space-y-3">
        <div
          v-for="gs in gamSellers"
          :key="gs.name"
          class="rounded-xl bg-white p-4 shadow-sm"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                :class="
                  gs.rank === 1
                    ? 'bg-yellow-100 text-yellow-700'
                    : gs.rank === 2
                      ? 'bg-gray-100 text-gray-600'
                      : gs.rank === 3
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-50 text-gray-500'
                "
              >
                {{ gs.rank }}
              </span>
              <div>
                <p class="text-sm font-medium text-gray-900">{{ gs.name }}</p>
                <p class="text-xs text-gray-500">
                  {{ gs.salesCount }} ventas · ${{ gs.totalUsd.toFixed(2) }}
                </p>
              </div>
            </div>
            <div class="text-right">
              <p
                class="text-sm font-bold"
                :class="
                  gs.goalPercent >= 100 ? 'text-green-600' : 'text-gray-700'
                "
              >
                {{ gs.goalPercent }}%
              </p>
              <p v-if="gs.currentStreak > 0" class="text-xs text-orange-500">
                {{ gs.currentStreak }}d racha
              </p>
            </div>
          </div>
          <!-- Goal progress bar -->
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              class="h-full rounded-full transition-all"
              :class="
                gs.goalPercent >= 100 ? 'bg-green-500' : 'bg-nova-primary'
              "
              :style="{ width: `${Math.min(gs.goalPercent, 100)}%` }"
            />
          </div>
        </div>
      </div>
    </div>
  </SharedReportLayout>
</template>
