import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

interface UseSidebarResizeInput {
  direction?: "left" | "right";
  initialWidth: number;
  maxWidth: number;
  minWidth: number;
  onResizeEnd?: (width: number) => void;
}

export function useSidebarResize({
  direction = "right",
  initialWidth,
  maxWidth,
  minWidth,
  onResizeEnd
}: UseSidebarResizeInput) {
  const [sidebarWidth, setSidebarWidth] = useState(() => clampWidth(initialWidth, minWidth, maxWidth));
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const sidebarResizingRef = useRef(false);
  const sidebarResizeStartXRef = useRef(0);
  const sidebarResizeStartWidthRef = useRef(0);
  const sidebarWidthRef = useRef(sidebarWidth);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    if (sidebarResizingRef.current) return;
    setSidebarWidth(clampWidth(initialWidth, minWidth, maxWidth));
  }, [initialWidth, maxWidth, minWidth]);

  const startSidebarResize = useCallback((event: ReactMouseEvent): void => {
    sidebarResizingRef.current = true;
    setIsSidebarResizing(true);
    sidebarResizeStartXRef.current = event.clientX;
    sidebarResizeStartWidthRef.current = sidebarWidth;
    event.preventDefault();
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent): void => {
      if (!sidebarResizingRef.current) return;
      const delta = direction === "right"
        ? event.clientX - sidebarResizeStartXRef.current
        : sidebarResizeStartXRef.current - event.clientX;
      const next = clampWidth(sidebarResizeStartWidthRef.current + delta, minWidth, maxWidth);
      setSidebarWidth(next);
    };
    const handleMouseUp = (): void => {
      if (!sidebarResizingRef.current) return;
      sidebarResizingRef.current = false;
      setIsSidebarResizing(false);
      onResizeEnd?.(sidebarWidthRef.current);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [direction, maxWidth, minWidth, onResizeEnd]);

  return {
    sidebarWidth,
    isSidebarResizing,
    startSidebarResize
  };
}

function clampWidth(value: number, minWidth: number, maxWidth: number): number {
  return Math.max(minWidth, Math.min(maxWidth, Math.round(value)));
}
