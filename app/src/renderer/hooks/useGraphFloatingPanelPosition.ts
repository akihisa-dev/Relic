import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent, RefObject } from "react";

import { clamp } from "../graphLayout";

export function useGraphFloatingPanelPosition(): {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  panelRef: RefObject<HTMLDivElement | null>;
  style: CSSProperties | undefined;
} {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (event.button !== 0) return;

    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!panel || !container) return;

    event.preventDefault();
    event.stopPropagation();

    const panelRect = panel.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offsetX = event.clientX - panelRect.left;
    const offsetY = event.clientY - panelRect.top;

    const move = (moveEvent: globalThis.PointerEvent): void => {
      const margin = 8;
      const maxX = Math.max(margin, containerRect.width - panelRect.width - margin);
      const maxY = Math.max(margin, containerRect.height - panelRect.height - margin);

      setPosition({
        x: clamp(moveEvent.clientX - containerRect.left - offsetX, margin, maxX),
        y: clamp(moveEvent.clientY - containerRect.top - offsetY, margin, maxY)
      });
    };

    const stop = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };

    setPosition({
      x: clamp(panelRect.left - containerRect.left, 8, Math.max(8, containerRect.width - panelRect.width - 8)),
      y: clamp(panelRect.top - containerRect.top, 8, Math.max(8, containerRect.height - panelRect.height - 8))
    });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  return {
    onPointerDown,
    panelRef,
    style: position
      ? { left: position.x, right: "auto", top: position.y, transform: "none" }
      : undefined
  };
}
