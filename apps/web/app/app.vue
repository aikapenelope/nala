<script setup lang="ts">
/**
 * Root app component.
 *
 * Restores the Nova user session from localStorage on app init.
 * This avoids a round-trip to /api/me on every page reload when
 * the user was already identified (Square POS pattern: instant restore).
 */
const { restoreUser } = useNovaAuth();
const { loadFromCache, startAutoRefresh } = useTeamRoster();

onMounted(() => {
  restoreUser();
  if (loadFromCache()) {
    startAutoRefresh();
  }
});
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
