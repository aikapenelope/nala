/**
 * POS tutorial composable — step-by-step guided walkthrough.
 *
 * Shows an interactive overlay on first POS visit that highlights
 * key areas: product grid, payment methods, and confirm button.
 *
 * State persisted in localStorage. Only shows once per user.
 */

export interface TutorialStep {
  /** CSS selector or element ref to highlight. */
  target: string;
  /** Short title for the step. */
  title: string;
  /** Description text. */
  description: string;
  /** Position of the tooltip relative to target. */
  position: "top" | "bottom" | "left" | "right";
}

const STORAGE_KEY = "nova:pos-tutorial-done";

export function usePosTutorial() {
  const isActive = ref(false);
  const currentStep = ref(0);

  const steps: TutorialStep[] = [
    {
      target: "[data-tutorial='product-grid']",
      title: "1. Toca un producto",
      description: "Selecciona los productos que el cliente quiere comprar. Se agregan al ticket automaticamente.",
      position: "bottom",
    },
    {
      target: "[data-tutorial='payment-methods']",
      title: "2. Selecciona el pago",
      description: "Elige como te paga el cliente: efectivo, pago movil, Binance, etc.",
      position: "top",
    },
    {
      target: "[data-tutorial='confirm-btn']",
      title: "3. Confirma la venta",
      description: "Listo. La venta se registra, el inventario se actualiza, y puedes enviar el recibo por WhatsApp.",
      position: "top",
    },
  ];

  /** Start tutorial if not previously completed. */
  function maybeStart() {
    if (import.meta.client) {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) {
        isActive.value = true;
        currentStep.value = 0;
      }
    }
  }

  /** Advance to next step or finish. */
  function next() {
    if (currentStep.value < steps.length - 1) {
      currentStep.value++;
    } else {
      finish();
    }
  }

  /** Skip/finish the tutorial. */
  function finish() {
    isActive.value = false;
    currentStep.value = 0;
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  }

  const activeStep = computed(() => {
    if (!isActive.value) return null;
    return steps[currentStep.value] ?? null;
  });

  const progress = computed(() => ({
    current: currentStep.value + 1,
    total: steps.length,
  }));

  return {
    isActive: readonly(isActive),
    activeStep,
    progress,
    maybeStart,
    next,
    finish,
  };
}
