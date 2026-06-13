"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "sanctuary" | "movement";
const STORAGE_KEY = "kbcf-theme";

type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };
const ThemeContext = createContext<Ctx>({ theme: "sanctuary", setTheme: () => {}, toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("sanctuary");

  // Sync from whatever the no-flash script already applied to <html>.
  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "sanctuary";
    setThemeState(current);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  }, []);

  const toggle = useCallback(() => {
    setTheme((document.documentElement.getAttribute("data-theme") as Theme) === "movement" ? "sanctuary" : "movement");
  }, [setTheme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/** Inline script: marks JS active (enables reveal animations) and applies the
 *  saved theme before paint (no flash). */
export const themeInitScript = `(function(){try{document.documentElement.classList.add('js');var t=localStorage.getItem('${STORAGE_KEY}');if(t==='movement'||t==='sanctuary'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
