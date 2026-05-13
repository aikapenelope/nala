/**
 * Global toast notification composable.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast("Producto guardado");
 *   toast("Error al guardar", "error");
 *   toast("Procesando...", "info");
 *
 * Toasts auto-dismiss after 3 seconds. Multiple toasts stack vertically.
 * The ToastContainer component must be mounted in the layout to render toasts.
 */

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

/** Shared reactive state across all composable instances. */
const toasts = ref<ToastItem[]>([]);
let nextId = 0;

export function useToast() {
  /**
   * Show a toast notification.
   * @param message - Text to display.
   * @param type - Visual style: "success" (green), "error" (red), "info" (gray). Defaults to "success".
   * @param duration - Auto-dismiss delay in ms. Defaults to 3000.
   */
  function toast(
    message: string,
    type: "success" | "error" | "info" = "success",
    duration = 3000,
  ) {
    const id = nextId++;
    toasts.value.push({ id, message, type });

    // Auto-dismiss
    setTimeout(() => {
      dismiss(id);
    }, duration);
  }

  /** Manually dismiss a toast by id. */
  function dismiss(id: number) {
    const idx = toasts.value.findIndex((t) => t.id === id);
    if (idx !== -1) {
      toasts.value.splice(idx, 1);
    }
  }

  return {
    /** Reactive list of active toasts (read-only for the component). */
    toasts: readonly(toasts),
    /** Show a toast notification. */
    toast,
    /** Dismiss a specific toast. */
    dismiss,
  };
}
