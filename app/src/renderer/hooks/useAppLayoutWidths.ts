import { useMemo, type MouseEvent as ReactMouseEvent } from "react";

import { coworkPanelMaxWidth, coworkPanelMinWidth, type AppUiSettings } from "../../shared/ipc";
import { titleBarEditorLeftOffset, titleBarLeftOffset } from "../appShellModel";
import { useSidebarResize } from "./useSidebarResize";

const RAIL_WIDTH = 56;
const TITLE_BAR_TRAFFIC_LIGHT_SPACE = 88;
const FLOATING_PANEL_GAP = 0;
const WORKSPACE_HORIZONTAL_PADDING = 0;

interface UseAppLayoutWidthsInput {
  appUiSettings: AppUiSettings;
  handleSaveAppUiSettings: (settings: AppUiSettings) => void;
  isSidebarOpen: boolean;
  isSecondarySidebarOpen: boolean;
}

export function useAppLayoutWidths({
  appUiSettings,
  handleSaveAppUiSettings,
  isSidebarOpen,
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
  titleBarEditorLeftOffsetWidth: number;
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
      isSidebarOpen ? sidebarWidth : 0,
      WORKSPACE_HORIZONTAL_PADDING,
      FLOATING_PANEL_GAP,
      isSecondarySidebarOpen ? secondarySidebarWidth : 0
    ),
    [isSecondarySidebarOpen, isSidebarOpen, secondarySidebarWidth, sidebarWidth]
  );
  const titleBarEditorLeftOffsetWidth = useMemo(
    () => titleBarEditorLeftOffset(
      RAIL_WIDTH,
      isSidebarOpen ? sidebarWidth : 0,
      WORKSPACE_HORIZONTAL_PADDING,
      FLOATING_PANEL_GAP,
      isSecondarySidebarOpen ? secondarySidebarWidth : 0
    ),
    [isSecondarySidebarOpen, isSidebarOpen, secondarySidebarWidth, sidebarWidth]
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
    titleBarEditorLeftOffsetWidth,
    titleBarLeftOffsetWidth
  };
}
