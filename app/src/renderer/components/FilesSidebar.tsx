import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import type { SearchMode, WorkspaceSearchResult, WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import { type FileTreeExpansionRequest } from "../fileTreeModel";
import { isFilteringFiles as isFilteringFilesModel } from "../filesSidebarModel";
import { useFileTreeSelection } from "../hooks/useFileTreeSelection";
import { FilesSearchResults } from "./FilesSearchResults";
import { FilesSidebarTreeSection } from "./FilesSidebarTreeSection";
import { FilesCreateActions, FilesWorkspaceActions, FilesWorkspaceEmpty } from "./FilesWorkspaceActions";

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
  const [expansionRequest, setExpansionRequest] = useState<FileTreeExpansionRequest | undefined>(undefined);
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
  const isFilteringFiles = isFilteringFilesModel({ isSearching, query: searchQuery, searchError });

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
                workspaceState={workspaceState}
              />
            ) : null}
          </div>
          <FilesWorkspaceActions
            isCreatingWorkspace={isCreatingWorkspace}
            isOpeningWorkspace={isOpeningWorkspace}
            onCreateWorkspace={onCreateWorkspace}
            onOpenWorkspace={onOpenWorkspace}
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
