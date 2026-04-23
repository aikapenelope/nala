<script setup lang="ts">
/**
 * Root app component.
 *
 * With Clerk Organizations, auth state comes from Clerk's JWT.
 * No localStorage restore needed.
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
