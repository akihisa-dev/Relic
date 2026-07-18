import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { createPortal } from "react-dom";

import type { SearchMode, WorkspaceSearchResult, WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import { type FileTreeExpansionRequest } from "../fileTreeModel";
import { contextMenuPosition } from "../fileTreeUi";
import { isFilteringFiles as isFilteringFilesModel } from "../filesSidebarModel";
import { useFileTreeSelection } from "../hooks/useFileTreeSelection";
import { useFileToolActions } from "../hooks/useFileToolActions";
import { useT } from "../i18n";
import { FilesSearchResults } from "./FilesSearchResults";
import { FilesSidebarTreeSection } from "./FilesSidebarTreeSection";
import { FilesCreateActions, FilesWorkspaceActions, FilesWorkspaceEmpty } from "./FilesWorkspaceActions";
import { FileToolsSubmenu } from "./FileToolsSubmenu";

export interface FilesSidebarProps {
  isCreatingFile: boolean;
  isCreatingFolder: boolean;
  isCreatingWorkspace: boolean;
  isSearching: boolean;
  isOpeningWorkspace: boolean;
  onCreateFile: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  onCreateFileInFolder?: (folderPath: string, name: string) => void;
  onCreateFolder: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  onCreateFolderInFolder?: (folderPath: string, name: string) => void;
  onCreateWorkspace: () => void;
  onDeleteItem: (path: string, type: WorkspaceTreeNode["type"]) => void;
  onDeleteItems: (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>) => void;
  onDuplicateFile: (path: string) => void;
  onImportMarkdownFiles: (sourcePaths: string[], destFolder: string) => void;
  onMoveFile: (path: string, destFolder: string) => void;
  onMoveFolder: (path: string, destFolder: string) => void;
  onMoveItems: (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>, destFolder: string) => void;
  onOpenFile: (path: string, event?: React.MouseEvent<HTMLButtonElement>, options?: { lineNumber?: number | null }) => void;
  onOpenInOtherPane?: (path: string) => void;
  onOpenQuickSwitcher: () => void;
  onOpenWorkspace: () => void;
  onRevealItem?: (path: string) => void;
  onRenameItem: (path: string, type: WorkspaceTreeNode["type"], newName: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onSelectedCountChange?: (count: number) => void;
  onShowToast: (text: string, type?: "error" | "info") => void;
  onTogglePin: (path: string) => void;
  openingFilePath?: string | null;
  openFilePaths?: Set<string>;
  searchError: string | null;
  searchFrontmatterField: string;
  searchLimitNotice: { skippedLongLines: number; skippedLargeFiles: number; truncated: boolean } | null;
  searchMode: SearchMode;
  searchQuery: string;
  searchResults: WorkspaceSearchResult[];
  workspaceState: WorkspaceState | null;
}

export function FilesSidebar({
  isCreatingFile,
  isCreatingFolder,
  isCreatingWorkspace,
  isSearching,
  isOpeningWorkspace,
  onCreateFile,
  onCreateFileInFolder,
  onCreateFolder,
  onCreateFolderInFolder,
  onCreateWorkspace,
  onDeleteItem,
  onDeleteItems,
  onDuplicateFile,
  onImportMarkdownFiles,
  onMoveFile,
  onMoveFolder,
  onMoveItems,
  onOpenFile,
  onOpenInOtherPane,
  onOpenQuickSwitcher,
  onOpenWorkspace,
  onRevealItem,
  onRenameItem,
  onSelectFolder,
  onSelectedCountChange,
  onShowToast,
  onTogglePin,
  openingFilePath,
  openFilePaths,
  searchError,
  searchFrontmatterField,
  searchLimitNotice,
  searchMode,
  searchQuery,
  searchResults,
  workspaceState
}: FilesSidebarProps): ReactElement {
  const t = useT();
  const [expansionRequest, setExpansionRequest] = useState<FileTreeExpansionRequest | undefined>(undefined);
  const [workspaceContextMenu, setWorkspaceContextMenu] = useState<{ x: number; y: number } | null>(null);
  const activeWorkspace = workspaceState?.activeWorkspace ?? null;
  const pinnedPaths = useMemo(
    () => new Set(workspaceState?.pinnedPaths ?? []),
    [workspaceState?.pinnedPaths]
  );
  const userNodes = useMemo(() => workspaceState?.fileTree ?? [], [workspaceState?.fileTree]);
  const { handleSelectItem, selectedItems, selectedPaths } = useFileTreeSelection({
    nodes: userNodes,
    onSelectedCountChange
  });
  const { onRunFileTool, runningFileTool } = useFileToolActions({
    onOpenFile: (path) => onOpenFile(path),
    onShowToast,
    t
  });
  const isFilteringFiles = isFilteringFilesModel({ isSearching, query: searchQuery, searchError });

  useEffect(() => {
    if (!workspaceContextMenu) return;
    const close = (): void => setWorkspaceContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [workspaceContextMenu]);

  const requestExpansion = (action: FileTreeExpansionRequest["action"], scopePath?: string): void => {
    setExpansionRequest((current) => ({ action, id: (current?.id ?? 0) + 1, scopePath }));
  };

  return (
    <div className={`sidebar-section${activeWorkspace ? " files-sidebar-section" : ""}`}>
      {activeWorkspace ? (
        <>
          <div className="files-sidebar-fixed-controls">
            <FilesCreateActions
              isCreatingFile={isCreatingFile}
              isCreatingFolder={isCreatingFolder}
              onCollapseAllFolders={() => requestExpansion("collapse")}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onExpandAllFolders={() => requestExpansion("expand")}
              onOpenQuickSwitcher={onOpenQuickSwitcher}
            />
          </div>
          <div className="files-sidebar-scroll-area">
            {isFilteringFiles ? (
              <FilesSearchResults
                error={searchError}
                frontmatterField={searchFrontmatterField}
                isSearching={isSearching}
                limitNotice={searchLimitNotice}
                mode={searchMode}
                onOpenFile={onOpenFile}
                openingFilePath={openingFilePath}
                query={searchQuery}
                results={searchResults}
              />
            ) : null}
            {!isFilteringFiles && workspaceState ? (
              <FilesSidebarTreeSection
                expansionRequest={expansionRequest}
                onDeleteItem={onDeleteItem}
                onDeleteSelectedItems={() => onDeleteItems(selectedItems)}
                onCreateFileInFolder={onCreateFileInFolder}
                onCreateFolderInFolder={onCreateFolderInFolder}
                onDuplicateFile={onDuplicateFile}
                onImportMarkdownFiles={onImportMarkdownFiles}
                onMoveFile={onMoveFile}
                onMoveFolder={onMoveFolder}
                onMoveItems={onMoveItems}
                onRunFileTool={onRunFileTool}
                onOpenFile={onOpenFile}
                onOpenInOtherPane={onOpenInOtherPane}
                onRequestExpansion={requestExpansion}
                onRevealItem={onRevealItem}
                onRenameItem={onRenameItem}
                onSelectFolder={onSelectFolder}
                onSelectItem={handleSelectItem}
                onTogglePin={onTogglePin}
                openingFilePath={openingFilePath}
                openFilePaths={openFilePaths}
                pinnedPaths={pinnedPaths}
                selectedItems={selectedItems}
                selectedPaths={selectedPaths}
                runningFileTool={runningFileTool}
                workspaceState={workspaceState}
              />
            ) : null}
          </div>
          {workspaceContextMenu ? createPortal(
            <div
              className="tab-context-menu file-tree-context-menu"
              onMouseDown={(event) => event.stopPropagation()}
              role="menu"
              style={{ left: workspaceContextMenu.x, position: "fixed", top: workspaceContextMenu.y, zIndex: 40 }}
            >
              <FileToolsSubmenu
                onClose={() => setWorkspaceContextMenu(null)}
                onRun={onRunFileTool}
                runningTool={runningFileTool}
                target={{ kind: "workspace" }}
              />
            </div>,
            document.body
          ) : null}
          <FilesWorkspaceActions
            isCreatingWorkspace={isCreatingWorkspace}
            isOpeningWorkspace={isOpeningWorkspace}
            onCreateWorkspace={onCreateWorkspace}
            onOpenWorkspace={onOpenWorkspace}
            onWorkspaceContextMenu={(event) => {
              event.preventDefault();
              setWorkspaceContextMenu(contextMenuPosition(event.clientX, event.clientY, { estimatedHeight: 40 }));
            }}
          />
        </>
      ) : (
        <FilesWorkspaceEmpty
          isCreatingWorkspace={isCreatingWorkspace}
          isOpeningWorkspace={isOpeningWorkspace}
          onCreateWorkspace={onCreateWorkspace}
          onOpenWorkspace={onOpenWorkspace}
        />
      )}
    </div>
  );
}
