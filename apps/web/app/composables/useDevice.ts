/**
 * Device detection composable.
 *
 * Determines if the user is on mobile, tablet, or desktop
 * based on viewport width. Used to switch between layouts.
 */

export function useDevice() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isTablet = useMediaQuery("(min-width: 769px) and (max-width: 1024px)");
  const isDesktop = useMediaQuery("(min-width: 1025px)");

  return { isMobile, isTablet, isDesktop };
}

/**
 * Simple media query composable using window.matchMedia.
 * Returns a reactive boolean that updates when the viewport changes.
 */
function useMediaQuery(query: string) {
  const matches = ref(false);

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
