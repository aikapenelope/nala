<script setup lang="ts">
/**
 * Owner sign-up page using Clerk's SignUp component.
 *
 * After Clerk creates the account, the user is redirected to /auth/resolve.
 * For new users without a business, /auth/resolve detects "no_org" and
 * redirects to /onboarding to create the business.
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
        :force-redirect-url="'/auth/resolve'"
        sign-in-url="/auth/login"
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
