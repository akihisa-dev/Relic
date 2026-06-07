import type { MouseEvent as ReactMouseEvent } from "react";

import { useSidebarResize } from "./useSidebarResize";

export function useAppLayoutWidths(): {
  isRightPanelResizing: boolean;
  isSidebarResizing: boolean;
  rightPanelWidth: number;
  sidebarWidth: number;
  startRightPanelResize: (event: ReactMouseEvent) => void;
  startSidebarResize: (event: ReactMouseEvent) => void;
} {
  const { sidebarWidth, isSidebarResizing, startSidebarResize } = useSidebarResize({
    initialWidth: 260,
    maxWidth: 500,
    minWidth: 180
  });
  const {
    sidebarWidth: rightPanelWidth,
    isSidebarResizing: isRightPanelResizing,
    startSidebarResize: startRightPanelResize
  } = useSidebarResize({
    direction: "left",
    initialWidth: 240,
    maxWidth: 520,
    minWidth: 220
  });
  return {
    isRightPanelResizing,
    isSidebarResizing,
    rightPanelWidth,
    sidebarWidth,
    startRightPanelResize,
    startSidebarResize
  };
}
