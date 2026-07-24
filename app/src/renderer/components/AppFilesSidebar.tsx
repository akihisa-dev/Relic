import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";

import { FilesSidebar, type FilesSidebarProps } from "./FilesSidebar";

interface AppFilesSidebarProps extends Omit<FilesSidebarProps, "onSelectedCountChange"> {
  isSidebarOpen: boolean;
  isSidebarResizing: boolean;
  onShowToast: (text: string, type?: "error" | "info") => void;
  sidebarWidth: number;
  startSidebarResize: (event: ReactMouseEvent) => void;
}

export function AppFilesSidebar({
  isSidebarOpen,
  isSidebarResizing,
  onShowToast: _onShowToast,
  sidebarWidth,
  startSidebarResize,
  ...filesSidebarProps
}: AppFilesSidebarProps): ReactElement {
  void isSidebarResizing;
  void startSidebarResize;

  return (
    <aside
      aria-hidden={!isSidebarOpen}
      className={`sidebar sidebar--no-header${isSidebarOpen ? "" : " sidebar--closed"}${isSidebarResizing ? " sidebar--resizing" : ""}`}
      style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
    >
      <div className="sidebar-body sidebar-view-content sidebar-view-content--files">
        <FilesSidebar {...filesSidebarProps} />
      </div>
    </aside>
  );
}
