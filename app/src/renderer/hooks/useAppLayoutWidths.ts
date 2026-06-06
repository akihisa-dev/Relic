import type { MouseEvent as ReactMouseEvent } from "react";

import { coworkPanelMaxWidth, coworkPanelMinWidth, type AppUiSettings } from "../../shared/ipc";
import { useSidebarResize } from "./useSidebarResize";

interface UseAppLayoutWidthsInput {
  appUiSettings: AppUiSettings;
  handleSaveAppUiSettings: (settings: AppUiSettings) => void;
}

export function useAppLayoutWidths({
  appUiSettings,
  handleSaveAppUiSettings
}: UseAppLayoutWidthsInput): {
  isRightPanelResizing: boolean;
  isSecondarySidebarResizing: boolean;
  isSidebarResizing: boolean;
  rightPanelWidth: number;
  secondarySidebarWidth: number;
  sidebarWidth: number;
  startRightPanelResize: (event: ReactMouseEvent) => void;
  startSecondarySidebarResize: (event: ReactMouseEvent) => void;
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
  const {
    sidebarWidth: secondarySidebarWidth,
    isSidebarResizing: isSecondarySidebarResizing,
    startSidebarResize: startSecondarySidebarResize
  } = useSidebarResize({
    initialWidth: appUiSettings.coworkPanelWidth,
    maxWidth: coworkPanelMaxWidth,
    minWidth: coworkPanelMinWidth,
    onResizeEnd: (width) => {
      handleSaveAppUiSettings({ ...appUiSettings, coworkPanelWidth: width });
    }
  });
  return {
    isRightPanelResizing,
    isSecondarySidebarResizing,
    isSidebarResizing,
    rightPanelWidth,
    secondarySidebarWidth,
    sidebarWidth,
    startRightPanelResize,
    startSecondarySidebarResize,
    startSidebarResize
  };
}
