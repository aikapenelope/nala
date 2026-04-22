/**
 * Device detection composable.
 *
 * Determines if the user is on mobile, tablet, or desktop
 * based on viewport width. Used to switch between layouts.
 *
 * On SSR, defaults to desktop to prevent layout flash (the desktop
 * layout is rendered server-side, then hydrated on the client).
 */

export function useDevice() {
  const isMobile = useMediaQuery("(max-width: 768px)", false);
  const isTablet = useMediaQuery(
    "(min-width: 769px) and (max-width: 1024px)",
    false,
  );
  const isDesktop = useMediaQuery("(min-width: 1025px)", true);

  return { isMobile, isTablet, isDesktop };
}

/**
 * Simple media query composable using window.matchMedia.
 * Returns a reactive boolean that updates when the viewport changes.
 *
 * @param ssrDefault - Value to use during SSR (before client hydration).
 */
function useMediaQuery(query: string, ssrDefault: boolean) {
  const matches = ref(ssrDefault);

  if (import.meta.client) {
    const mediaQuery = window.matchMedia(query);
    matches.value = mediaQuery.matches;

    const handler = (e: MediaQueryListEvent) => {
      matches.value = e.matches;
    };

    mediaQuery.addEventListener("change", handler);

    onUnmounted(() => {
      mediaQuery.removeEventListener("change", handler);
    });
  }

  return readonly(matches);
}
