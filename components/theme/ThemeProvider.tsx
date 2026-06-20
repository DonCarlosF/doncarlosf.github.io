"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "sanctuary" | "grove" | "sterling" | "ember" | "movement";
const STORAGE_KEY = "kbcf-theme";
const EVENT = "kbcf-theme-change";
const THEMES: Theme[] = ["sanctuary", "grove", "sterling", "ember", "movement"];

// The active theme lives on <html data-theme>. We treat that attribute as an
// external store so components stay in sync without setState-in-effect.
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
function getSnapshot(): Theme {
  return (document.documentElement.getAttribute("data-theme") as Theme) || "sanctuary";
}
function getServerSnapshot(): Theme {
  return "sanctuary";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const toggle = useCallback(() => {
    const i = THEMES.indexOf(getSnapshot());
    setTheme(THEMES[(i + 1) % THEMES.length]);
  }, [setTheme]);

  return { theme, setTheme, toggle };
}

/** Kept for layout composition; theme state lives on <html>, not in React. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Inline script: marks JS active (enables reveal animations) and applies the
 *  saved theme before paint (no flash). */
export const themeInitScript = `(function(){try{document.documentElement.classList.add('js');var t=localStorage.getItem('${STORAGE_KEY}');if(['sanctuary','grove','sterling','ember','movement'].indexOf(t)>=0){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
