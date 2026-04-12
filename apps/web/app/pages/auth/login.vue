<script setup lang="ts">
/**
 * Owner login page using Clerk's SignIn component.
 *
 * Shown when the owner taps "Iniciar como dueno" on the PIN screen.
 * After sign-in, Clerk redirects to the dashboard where the auth
 * middleware picks up the session.
 */

definePageMeta({ layout: false });
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-md">
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-bold text-nova-primary">Nova</h1>
        <p class="mt-1 text-sm text-gray-500">Inicia sesion como dueno</p>
      </div>

      <SignIn
        :routing="'hash'"
        :redirect-url="'/'"
        :appearance="{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-none border border-gray-200 rounded-xl',
          },
        }"
      />

      <div class="mt-6 text-center">
        <NuxtLink
          to="/auth/pin"
          class="text-sm text-gray-500 hover:text-nova-primary"
        >
          Ingresar con PIN de empleado
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
