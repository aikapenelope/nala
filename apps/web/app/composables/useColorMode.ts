/**
 * Color mode composable for the storefront.
 *
 * Supports three modes:
 * - "light": always light
 * - "dark": always dark
 * - "system": follow OS preference (default)
 *
 * Persists choice in localStorage. Applies .dark class to <html>.
 * Only used by the storefront layout — the admin dashboard stays light.
 */

type ColorMode = "light" | "dark" | "system";

const STORAGE_KEY = "nova-storefront-color-mode";

export function useColorMode() {
  const mode = useState<ColorMode>("color-mode", () => "system");
  const isDark = useState<boolean>("color-mode-dark", () => false);

  /** Resolve the effective dark/light state from mode + system preference. */
  function resolve() {
    if (!import.meta.client) return;

    let dark = false;
    if (mode.value === "dark") {
      dark = true;
    } else if (mode.value === "system") {
      dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    isDark.value = dark;
    document.documentElement.classList.toggle("dark", dark);
  }

  /** Set the color mode and persist. */
  function setMode(newMode: ColorMode) {
    mode.value = newMode;
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, newMode);
    }
    resolve();
  }

  /** Cycle through modes: system -> light -> dark -> system. */
  function toggle() {
    const next: Record<ColorMode, ColorMode> = {
      system: "light",
      light: "dark",
      dark: "system",
    };
    setMode(next[mode.value]);
  }

  /** Initialize from localStorage + listen for system changes. */
  function init() {
    if (!import.meta.client) return;

    const stored = localStorage.getItem(STORAGE_KEY) as ColorMode | null;
    if (stored && ["light", "dark", "system"].includes(stored)) {
      mode.value = stored;
    }

    resolve();

    // Listen for OS preference changes (only matters in "system" mode)
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (mode.value === "system") resolve();
      });
  }

  return {
    mode: readonly(mode),
    isDark: readonly(isDark),
    setMode,
    toggle,
    init,
  };
}
