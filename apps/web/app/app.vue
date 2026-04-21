<script setup lang="ts">
/**
 * Root app component.
 *
 * Restores the Nova user session from localStorage on app init.
 */
const { restoreUser } = useNovaAuth();

onMounted(() => {
  restoreUser();
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
