import { useEffect } from "react";

import type { AppTheme } from "../../shared/ipc";

export function useAppTheme(theme: AppTheme | undefined): void {
  useEffect(() => {
    function applyTheme(nextTheme: AppTheme) {
      const root = document.documentElement;
      if (nextTheme === "system") {
        root.removeAttribute("data-theme");
      } else {
        root.setAttribute("data-theme", nextTheme);
      }
    }

    const effectiveTheme = theme ?? "system";
    applyTheme(effectiveTheme);

    if (effectiveTheme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme("system");
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }

    return undefined;
  }, [theme]);
}
