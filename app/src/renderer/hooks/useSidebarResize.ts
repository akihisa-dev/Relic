import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

interface UseSidebarResizeInput {
  initialWidth: number;
  maxWidth: number;
  minWidth: number;
}

export function useSidebarResize({
  initialWidth,
  maxWidth,
  minWidth
}: UseSidebarResizeInput) {
  const [sidebarWidth, setSidebarWidth] = useState(initialWidth);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const sidebarResizingRef = useRef(false);
  const sidebarResizeStartXRef = useRef(0);
  const sidebarResizeStartWidthRef = useRef(0);

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
      const delta = event.clientX - sidebarResizeStartXRef.current;
      const next = Math.max(minWidth, Math.min(maxWidth, sidebarResizeStartWidthRef.current + delta));
      setSidebarWidth(next);
    };
    const handleMouseUp = (): void => {
      sidebarResizingRef.current = false;
      setIsSidebarResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [maxWidth, minWidth]);

  return {
    sidebarWidth,
    isSidebarResizing,
    startSidebarResize
  };
}
