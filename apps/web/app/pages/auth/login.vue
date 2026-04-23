<script setup lang="ts">
/**
 * Login page using Clerk's SignIn component.
 *
 * After sign-in, Clerk redirects to /auth/resolve (configured in nuxt.config.ts).
 */

definePageMeta({ layout: false });

onMounted(() => {
  // Clear session-expired banner when arriving at login page
  const sessionExpired = useState<boolean>("session-expired");
  sessionExpired.value = false;
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-md">
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-bold text-nova-primary">Nova</h1>
        <p class="mt-1 text-sm text-gray-500">Inicia sesion</p>
      </div>

      <SignIn
        :routing="'hash'"
        :redirect-url="'/auth/resolve'"
        :appearance="{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-none border border-gray-200 rounded-xl',
          },
        }"
      />

      <div class="mt-6 text-center">
        <p class="text-xs text-gray-400">
          Empleados: pide tu link de acceso al administrador
        </p>
      </div>
    </div>
  </div>
</template>
