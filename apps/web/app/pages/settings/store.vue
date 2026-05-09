<script setup lang="ts">
/**
 * Redirect: /settings/store → /store
 *
 * This page was replaced by /store/index.vue which has the full
 * store management UI with setup wizard and glassmorphism design.
 * Kept as a redirect so existing bookmarks and sidebar links still work.
 */
navigateTo("/store", { redirectCode: 301, replace: true });
</script>

<template>
  <div class="py-12 text-center text-sm text-gray-400">
    Redirigiendo a Tienda Online...
  </div>
</template>
