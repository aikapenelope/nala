<script setup lang="ts">
/**
 * Sign-in token acceptance page.
 *
 * When an employee receives an access link from the admin, they open
 * this page. The link contains a Clerk sign-in token as a query param.
 * This page uses the token to authenticate the employee via Clerk,
 * then resolves their Nova account and redirects to the dashboard.
 *
 * URL format: /auth/accept-token?token=<clerk-sign-in-token>
 */

definePageMeta({ layout: false });

const route = useRoute();
const router = useRouter();
const { resolveClerkUser, isAuthenticated } = useNovaAuth();

const error = ref("");
const isProcessing = ref(true);

async function processToken() {
  isProcessing.value = true;
  error.value = "";

  const token = route.query.token as string | undefined;

  if (!token) {
    error.value = "Link invalido. Pide un nuevo link a tu administrador.";
    isProcessing.value = false;
    return;
  }

  // If already authenticated, go to dashboard
  if (isAuthenticated.value) {
    router.replace("/");
    return;
  }

  if (!import.meta.client) return;

  try {
    // Use Clerk's signIn.create with the ticket strategy
    const { signIn, setActive } = useSignIn();

    if (!signIn.value) {
      error.value = "Error de inicializacion. Intenta recargar la pagina.";
      isProcessing.value = false;
      return;
    }

    // Authenticate with the sign-in token
    const result = await signIn.value.create({
      strategy: "ticket",
      ticket: token,
    });

    if (result.status === "complete" && result.createdSessionId) {
      // Set the session as active
      await setActive({ session: result.createdSessionId });

      // Wait a moment for Clerk to propagate the session
      await new Promise((r) => setTimeout(r, 500));

      // Resolve the Nova user from the backend
      let lastStatus: "ok" | "not_found" | "error" = "error";

      for (let attempt = 0; attempt < 3; attempt++) {
        const resolveResult = await resolveClerkUser();
        lastStatus = resolveResult.status;

        if (resolveResult.status === "ok") {
          router.replace("/");
          return;
        }

        if (resolveResult.status === "not_found") {
          // Employee's Clerk account exists but no Nova user found.
          // This shouldn't happen if the admin created them properly.
          error.value =
            "Tu cuenta no esta configurada. Contacta a tu administrador.";
          isProcessing.value = false;
          return;
        }

        // Wait before retrying
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      if (lastStatus === "error") {
        error.value =
          "No se pudo conectar con el servidor. Verifica tu conexion e intenta de nuevo.";
        isProcessing.value = false;
      }
    } else {
      error.value =
        "El link ha expirado o ya fue usado. Pide un nuevo link a tu administrador.";
      isProcessing.value = false;
    }
  } catch (err) {
    console.error("Token sign-in error:", err);

    // Check for specific Clerk errors
    const clerkError = err as {
      errors?: Array<{ code: string; message: string }>;
    };
    if (clerkError.errors?.length) {
      const firstError = clerkError.errors[0];
      if (
        firstError.code === "form_identifier_not_found" ||
        firstError.code === "ticket_expired"
      ) {
        error.value =
          "El link ha expirado o ya fue usado. Pide un nuevo link a tu administrador.";
      } else {
        error.value = firstError.message;
      }
    } else {
      error.value =
        "Error al procesar el link. Intenta de nuevo o pide un nuevo link.";
    }
    isProcessing.value = false;
  }
}

onMounted(() => {
  processToken();
});
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#f8f7ff] via-[#f0eef9] to-[#e8e4f3] px-4"
  >
    <!-- Processing state -->
    <div v-if="isProcessing" class="text-center">
      <div
        class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-3 border-nova-accent/30 border-t-nova-accent"
      />
      <p class="text-sm font-medium text-gray-600">Conectando tu cuenta...</p>
      <p class="mt-1 text-[11px] text-gray-400">
        Esto puede tomar unos segundos
      </p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="max-w-sm text-center">
      <div
        class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50"
      >
        <span class="text-2xl">!</span>
      </div>
      <p class="text-sm font-semibold text-red-600">{{ error }}</p>
      <button
        class="mt-4 dark-pill rounded-2xl px-6 py-2.5 text-sm font-bold transition-spring"
        @click="processToken"
      >
        Reintentar
      </button>
      <NuxtLink
        to="/landing"
        class="mt-3 block text-xs font-bold text-gray-400 transition-spring hover:text-gray-600"
      >
        Volver al inicio
      </NuxtLink>
    </div>
  </div>
</template>
