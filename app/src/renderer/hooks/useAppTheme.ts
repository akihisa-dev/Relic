import { useEffect, useState } from "react";

import type { AppTheme } from "../../shared/ipc";

export function useAppTheme(theme: AppTheme | undefined): boolean {
  const effectiveTheme = theme ?? "system";
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (effectiveTheme !== "system") return effectiveTheme === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    function applyTheme(nextTheme: AppTheme) {
      const root = document.documentElement;
      if (nextTheme === "system") {
        root.removeAttribute("data-theme");
      } else {
        root.setAttribute("data-theme", nextTheme);
      }
    }

    applyTheme(effectiveTheme);

    if (effectiveTheme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = (event: MediaQueryListEvent) => setIsDarkTheme(event.matches);
      setIsDarkTheme(mq.matches);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }

    setIsDarkTheme(effectiveTheme === "dark");
    return undefined;
  }, [effectiveTheme]);

  return isDarkTheme;
}
