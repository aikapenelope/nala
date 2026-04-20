/**
 * Shared business open/close state.
 *
 * Provides reactive isOpen state that persists across page navigations.
 * Used by AppHeader (toggle display) and day-close (reset after close).
 */

const _isOpen = ref<boolean | null>(null);
const _isChecking = ref(false);

export function useCashStatus() {
  const { $api } = useApi();

  async function checkOpenStatus() {
    _isChecking.value = true;
    try {
      const result = await $api<{ opening: unknown | null }>(
        "/api/cash-opening/latest",
      );
      _isOpen.value = result.opening !== null;
    } catch {
      _isOpen.value = null;
    } finally {
      _isChecking.value = false;
    }
  }

  function setOpen(value: boolean) {
    _isOpen.value = value;
  }

  return {
    isOpen: _isOpen,
    isChecking: _isChecking,
    checkOpenStatus,
    setOpen,
  };
}
