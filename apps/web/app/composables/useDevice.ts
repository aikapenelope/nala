/**
 * Device detection composable.
 *
 * Determines if the user is on mobile, tablet, or desktop
 * based on viewport width. Used to switch between layouts.
 *
 * On SSR, defaults to mobile (PWA-first). This prevents layout flash
 * on mobile devices which are the primary target. Desktop users get
 * a brief mobile flash that resolves on hydration.
 */

export function useDevice() {
  const isMobile = useMediaQuery("(max-width: 768px)", true);
  const isTablet = useMediaQuery(
    "(min-width: 769px) and (max-width: 1024px)",
    false,
  );
  const isDesktop = useMediaQuery("(min-width: 1025px)", false);

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
