import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";

import type { AppRailView } from "../appShellModel";
import type { SidebarView } from "../store/uiStore";
import { FilesSidebar, type FilesSidebarProps } from "./FilesSidebar";

interface AppFilesSidebarProps extends Omit<FilesSidebarProps, "onSelectedCountChange"> {
  activeSidebarView: SidebarView;
  fileSelectionCount: number;
  isSidebarOpen: boolean;
  isSidebarResizing: boolean;
  onSelectedCountChange: (count: number) => void;
  selectedCountLabel: string;
  sidebarViews: Array<Pick<AppRailView<ReactElement>, "id" | "label">>;
  sidebarWidth: number;
  startSidebarResize: (event: ReactMouseEvent) => void;
}

export function AppFilesSidebar({
  activeSidebarView,
  fileSelectionCount,
  isSidebarOpen,
  isSidebarResizing,
  onSelectedCountChange,
  selectedCountLabel,
  sidebarViews,
  sidebarWidth,
  startSidebarResize,
  ...filesSidebarProps
}: AppFilesSidebarProps): ReactElement {
  const heading = sidebarViews.find((view) => view.id === activeSidebarView)?.label;

  return (
    <aside
      aria-hidden={!isSidebarOpen}
      className={`sidebar${isSidebarOpen ? "" : " sidebar--closed"}${isSidebarResizing ? " sidebar--resizing" : ""}`}
      style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
    >
      <div className="sidebar-header">
        <div className="pane-heading">
          {heading}
          {activeSidebarView === "files" && fileSelectionCount > 1 ? (
            <span className="pane-heading-count">
              {selectedCountLabel}
            </span>
          ) : null}
        </div>
      </div>
      <div className={`sidebar-body sidebar-view-content sidebar-view-content--${activeSidebarView}`}>
        {activeSidebarView === "files" ? (
          <FilesSidebar
            {...filesSidebarProps}
            onSelectedCountChange={onSelectedCountChange}
          />
        ) : null}
      </div>
      <div
        className={`sidebar-resize-handle${isSidebarResizing ? " sidebar-resize-handle--active" : ""}`}
        onMouseDown={startSidebarResize}
      />
    </aside>
  );
}
