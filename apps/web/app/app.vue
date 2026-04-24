<script setup lang="ts">
/**
 * Root app component.
 *
 * Auth state is managed by Clerk and resolved via /auth/resolve.
 */
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
