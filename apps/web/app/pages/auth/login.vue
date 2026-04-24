<script setup lang="ts">
/**
 * Login page using Clerk's SignIn component.
 *
 * After sign-in, Clerk redirects to /auth/resolve via forceRedirectUrl.
 * If the user is already signed in, redirect to /auth/resolve directly
 * because Clerk's <SignIn> component won't render for active sessions.
 */

definePageMeta({ layout: false });

const router = useRouter();

onMounted(() => {
  // Clear session-expired banner when arriving at login page
  const sessionExpired = useState<boolean>("session-expired");
  sessionExpired.value = false;

  // If already signed in with Clerk, skip the login form and go to resolve.
  // The <SignIn> component won't render for active sessions anyway.
  const { isSignedIn, isLoaded } = useAuth();
  if (isLoaded.value && isSignedIn.value) {
    router.replace("/auth/resolve");
  }
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
        :force-redirect-url="'/auth/resolve'"
        sign-up-url="/auth/signup"
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
