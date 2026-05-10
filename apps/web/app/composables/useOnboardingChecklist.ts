/**
 * Onboarding checklist composable.
 *
 * Fetches the status of key setup steps and provides a checklist
 * for the dashboard widget. Hides automatically when all steps
 * are complete.
 *
 * Usage:
 *   const { steps, allComplete, isLoading, refresh } = useOnboardingChecklist();
 */

export interface OnboardingStep {
  id: string;
  label: string;
  complete: boolean;
  to: string;
}

export function useOnboardingChecklist() {
  const { $api } = useApi();
  const { user } = useNovaAuth();

  const isLoading = ref(false);
  const hasProducts = ref(false);
  const hasPaymentMethods = ref(false);
  const storeEnabled = ref(false);

  /** Whether the user has a business slug (required for store URL). */
  const hasSlug = computed(() => !!user.value?.businessSlug);

  /** Whether the business exists (always true if authenticated). */
  const hasBusinessCreated = computed(() => !!user.value?.businessId);

  const steps = computed<OnboardingStep[]>(() => [
    {
      id: "business",
      label: "Crear negocio",
      complete: hasBusinessCreated.value,
      to: "/settings/business",
    },
    {
      id: "products",
      label: "Agregar productos",
      complete: hasProducts.value,
      to: "/inventory",
    },
    {
      id: "payment",
      label: "Configurar metodos de pago",
      complete: hasPaymentMethods.value,
      to: "/store",
    },
    {
      id: "store",
      label: "Activar tienda",
      complete: storeEnabled.value,
      to: "/store",
    },
    {
      id: "share",
      label: "Compartir link",
      complete: hasSlug.value && storeEnabled.value,
      to: "/store",
    },
  ]);

  const allComplete = computed(() => steps.value.every((s) => s.complete));

  const completedCount = computed(
    () => steps.value.filter((s) => s.complete).length,
  );

  /** Fetch checklist data from existing API endpoints. */
  async function refresh() {
    isLoading.value = true;
    try {
      const [inventoryResult, storeResult] = await Promise.allSettled([
        $api<{ data: { totalProducts: number } }>("/api/reports/inventory"),
        $api<{
          settings: {
            storeEnabled: boolean;
            paymentMethods: Array<{ method: string }>;
          };
        }>("/api/store-settings"),
      ]);

      if (inventoryResult.status === "fulfilled") {
        hasProducts.value = inventoryResult.value.data.totalProducts > 0;
      }

      if (storeResult.status === "fulfilled") {
        const s = storeResult.value.settings;
        hasPaymentMethods.value = s.paymentMethods.length > 0;
        storeEnabled.value = s.storeEnabled;
      }
    } catch {
      // Non-critical — checklist just won't show progress
    } finally {
      isLoading.value = false;
    }
  }

  return {
    steps,
    allComplete,
    completedCount,
    isLoading: readonly(isLoading),
    refresh,
  };
}
