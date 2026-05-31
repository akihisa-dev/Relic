import { useMemo, type MouseEvent as ReactMouseEvent } from "react";

import { coworkPanelMaxWidth, coworkPanelMinWidth, type AppUiSettings } from "../../shared/ipc";
import { titleBarLeftOffset } from "../appShellModel";
import { useSidebarResize } from "./useSidebarResize";

const RAIL_WIDTH = 48;
const TITLE_BAR_TRAFFIC_LIGHT_SPACE = 88;
const FLOATING_PANEL_GAP = 10;
const WORKSPACE_HORIZONTAL_PADDING = 12;

interface UseAppLayoutWidthsInput {
  appUiSettings: AppUiSettings;
  handleSaveAppUiSettings: (settings: AppUiSettings) => void;
  isSecondarySidebarOpen: boolean;
}

export function useAppLayoutWidths({
  appUiSettings,
  handleSaveAppUiSettings,
  isSecondarySidebarOpen
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
  titleBarLeftOffsetWidth: number;
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
  const titleBarLeftOffsetWidth = useMemo(
    () => titleBarLeftOffset(
      TITLE_BAR_TRAFFIC_LIGHT_SPACE,
      RAIL_WIDTH,
      sidebarWidth,
      WORKSPACE_HORIZONTAL_PADDING,
      FLOATING_PANEL_GAP,
      isSecondarySidebarOpen ? secondarySidebarWidth : 0
    ),
    [isSecondarySidebarOpen, secondarySidebarWidth, sidebarWidth]
  );

  return {
    isRightPanelResizing,
    isSecondarySidebarResizing,
    isSidebarResizing,
    rightPanelWidth,
    secondarySidebarWidth,
    sidebarWidth,
    startRightPanelResize,
    startSecondarySidebarResize,
    startSidebarResize,
    titleBarLeftOffsetWidth
  };
}
