import { useEffect, type RefObject } from "react";

export function useDismissablePopover(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  close: (restoreFocus: boolean) => void
): void {
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent): void => {
      if (!ref.current?.contains(event.target as Node)) close(false);
    };
    const keyboard = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", keyboard);
    };
  }, [close, open, ref]);
}
