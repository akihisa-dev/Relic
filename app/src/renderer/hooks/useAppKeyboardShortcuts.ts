import { useEffect } from "react";

import type { AppCommandActions } from "../appCommandActions";
import { isPrimaryShortcutEvent } from "../keyboardShortcuts";

interface UseAppKeyboardShortcutsInput {
  actions: AppCommandActions;
}

export function useAppKeyboardShortcuts({ actions }: UseAppKeyboardShortcutsInput): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (!isPrimaryShortcutEvent(event)) return;

      const key = event.key.toLowerCase();

      if (event.shiftKey && key === "p") {
        event.preventDefault();
        actions["open-command-palette"]();
      } else if (!event.shiftKey && key === "p") {
        event.preventDefault();
        actions["open-quick-switcher"]();
      } else if (key === "b" && !event.shiftKey) {
        event.preventDefault();
        actions["toggle-sidebar"]();
      } else if (event.key === "\\") {
        event.preventDefault();
        actions["toggle-split"]();
      } else if (key === "b" && event.shiftKey) {
        event.preventDefault();
        actions["toggle-right-panel"]();
      } else if (key === "w" && !event.shiftKey) {
        event.preventDefault();
        actions["close-tab"]();
      } else if (key === "f") {
        event.preventDefault();
        actions["open-search"]();
      } else if (key === "n" && !event.shiftKey) {
        event.preventDefault();
        actions["new-note"]();
      } else if (key === "t" && event.shiftKey) {
        event.preventDefault();
        actions["reopen-closed-tab"]();
      }
    };

    window.addEventListener("keydown", handler, true);

    return () => window.removeEventListener("keydown", handler, true);
  }, [actions]);
}
