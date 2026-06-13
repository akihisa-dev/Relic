import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";

import type { AppRailView } from "../appShellModel";
import type { SidebarView } from "../store/uiStore";
import type { RelicDiagramType } from "../../shared/diagramMarkdown";
import { FilesSidebar, type FilesSidebarProps } from "./FilesSidebar";
import { DiagramSidebar } from "./DiagramSidebar";

interface AppFilesSidebarProps extends Omit<FilesSidebarProps, "onSelectedCountChange"> {
  activeSidebarView: SidebarView;
  fileSelectionCount: number;
  isSidebarOpen: boolean;
  isSidebarResizing: boolean;
  onCloseSidebar: () => void;
  onCreateDiagramFile: (type: RelicDiagramType) => void;
  onSelectedCountChange: (count: number) => void;
  selectedCountLabel: string;
  sidebarViews: Array<Pick<AppRailView<ReactElement>, "id" | "label">>;
  sidebarWidth: number;
  startSidebarResize: (event: ReactMouseEvent) => void;
}

export function AppFilesSidebar({
  activeSidebarView,
  fileSelectionCount: _fileSelectionCount,
  isSidebarOpen,
  isSidebarResizing,
  onCloseSidebar,
  onCreateDiagramFile,
  onSelectedCountChange,
  selectedCountLabel: _selectedCountLabel,
  sidebarViews,
  sidebarWidth,
  startSidebarResize,
  ...filesSidebarProps
}: AppFilesSidebarProps): ReactElement {
  const heading = sidebarViews.find((view) => view.id === activeSidebarView)?.label;
  const showHeader = activeSidebarView !== "files";

  void isSidebarResizing;
  void startSidebarResize;

  return (
    <aside
      aria-hidden={!isSidebarOpen}
      className={`sidebar${isSidebarOpen ? "" : " sidebar--closed"}${isSidebarResizing ? " sidebar--resizing" : ""}${showHeader ? "" : " sidebar--no-header"}`}
      style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
    >
      {showHeader ? (
        <div className="sidebar-header">
          <div className="pane-heading sidebar-pane-heading">
            <span>{heading}</span>
            <button
              aria-label={heading}
              className="sidebar-close-button"
              onClick={onCloseSidebar}
              title={heading}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      <div className={`sidebar-body sidebar-view-content sidebar-view-content--${activeSidebarView}`}>
        {activeSidebarView === "files" ? (
          <FilesSidebar
            {...filesSidebarProps}
            onSelectedCountChange={onSelectedCountChange}
          />
        ) : null}
        {activeSidebarView === "diagram" ? (
          <DiagramSidebar
            isCreatingFile={filesSidebarProps.isCreatingFile}
            isCreatingWorkspace={filesSidebarProps.isCreatingWorkspace}
            isOpeningWorkspace={filesSidebarProps.isOpeningWorkspace}
            onCreateWorkspace={filesSidebarProps.onCreateWorkspace}
            onCreateDiagramFile={onCreateDiagramFile}
            onDeleteItem={filesSidebarProps.onDeleteItem}
            onOpenFile={filesSidebarProps.onOpenFile}
            onOpenWorkspace={filesSidebarProps.onOpenWorkspace}
            openingFilePath={filesSidebarProps.openingFilePath}
            openFilePaths={filesSidebarProps.openFilePaths}
            workspaceState={filesSidebarProps.workspaceState}
          />
        ) : null}
      </div>
    </aside>
  );
}
