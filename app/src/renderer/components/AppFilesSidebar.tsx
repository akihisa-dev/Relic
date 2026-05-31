import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";

import type { AppRailView } from "../appShellModel";
import type { SidebarView } from "../store/uiStore";
import type { AIWorkspaceState } from "../../shared/ipc";
import { AIChatsSidebar } from "./AIChatsSidebar";
import { FilesSidebar, type FilesSidebarProps } from "./FilesSidebar";

interface AppFilesSidebarProps extends Omit<FilesSidebarProps, "onSelectedCountChange"> {
  activeSidebarView: SidebarView;
  aiWorkspaceState: AIWorkspaceState | null;
  fileSelectionCount: number;
  isAIWorkspaceLoading: boolean;
  isSidebarOpen: boolean;
  isSidebarResizing: boolean;
  onCreateAIChat: () => void;
  onSelectAIChat: (chatId: string) => void;
  onSelectedCountChange: (count: number) => void;
  selectedCountLabel: string;
  sidebarViews: Array<Pick<AppRailView<ReactElement>, "id" | "label">>;
  sidebarWidth: number;
  startSidebarResize: (event: ReactMouseEvent) => void;
}

export function AppFilesSidebar({
  activeSidebarView,
  aiWorkspaceState,
  fileSelectionCount: _fileSelectionCount,
  isAIWorkspaceLoading,
  isSidebarOpen,
  isSidebarResizing,
  onCreateAIChat,
  onSelectAIChat,
  onSelectedCountChange,
  selectedCountLabel: _selectedCountLabel,
  sidebarViews,
  sidebarWidth,
  startSidebarResize,
  ...filesSidebarProps
}: AppFilesSidebarProps): ReactElement {
  const heading = sidebarViews.find((view) => view.id === activeSidebarView)?.label;
  const showHeader = activeSidebarView !== "files";

  return (
    <aside
      aria-hidden={!isSidebarOpen}
      className={`sidebar${isSidebarOpen ? "" : " sidebar--closed"}${isSidebarResizing ? " sidebar--resizing" : ""}${showHeader ? "" : " sidebar--no-header"}`}
      style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
    >
      {showHeader ? (
        <div className="sidebar-header">
          <div className="pane-heading">{heading}</div>
        </div>
      ) : null}
      <div className={`sidebar-body sidebar-view-content sidebar-view-content--${activeSidebarView}`}>
        {activeSidebarView === "files" ? (
          <FilesSidebar
            {...filesSidebarProps}
            onSelectedCountChange={onSelectedCountChange}
          />
        ) : activeSidebarView === "ai" ? (
          <AIChatsSidebar
            isLoading={isAIWorkspaceLoading}
            onCreateChat={onCreateAIChat}
            onSelectChat={onSelectAIChat}
            state={aiWorkspaceState}
          />
        ) : null}
      </div>
      <button
        aria-label={heading ? `${heading} resize` : "Resize sidebar"}
        className={`sidebar-resize-handle${isSidebarResizing ? " sidebar-resize-handle--active" : ""}`}
        onMouseDown={startSidebarResize}
        type="button"
      />
    </aside>
  );
}
