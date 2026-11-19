import { useSyncExternalStore } from "react";

const DESKTOP = "(min-width: 1024px)";
const WIDE = "(min-width: 1264px)";

/**
 * Läser en media query utan att rendera fel på servern. Servern svarar false,
 * så mobilmarkupen är den som hydreras; desktop-vyn tar över först i webbläsaren.
 */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      // Resize fångar även miljöer där matchMedia inte skickar change.
      window.addEventListener("resize", onChange);
      return () => {
        list.removeEventListener("change", onChange);
        window.removeEventListener("resize", onChange);
      };
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** ≥1024px: sidomeny + innehåll, ingen högerkolumn. */
export const useDesktop = () => useMediaQuery(DESKTOP);

/** ≥1264px: expanderad sidomeny och högerkolumn. */
export const useWideDesktop = () => useMediaQuery(WIDE);
