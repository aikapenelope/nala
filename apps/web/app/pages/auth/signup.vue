<script setup lang="ts">
/**
 * Owner sign-up page using Clerk's SignUp component.
 *
 * This is the first step for new users. After Clerk creates the account,
 * the user is redirected to /auth/resolve which:
 * - Calls GET /api/me
 * - Gets USER_NOT_FOUND (no business yet)
 * - Redirects to /onboarding to configure the business
 *
 * Matches the Square pattern: account creation and business setup
 * are separate steps with clear purpose.
 */

definePageMeta({ layout: false });
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-md">
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-bold text-nova-primary">Nova</h1>
        <p class="mt-1 text-sm text-gray-500">Crea tu cuenta para empezar</p>
      </div>

      <SignUp
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
        <NuxtLink
          to="/auth/login"
          class="text-sm text-gray-500 hover:text-nova-primary"
        >
          Ya tengo cuenta
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
