import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import type { SearchMode, WorkspaceSearchResult, WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import { type FileTreeExpansionRequest } from "../fileTreeModel";
import { isFilteringFiles as isFilteringFilesModel } from "../filesSidebarModel";
import { useFileTreeSelection } from "../hooks/useFileTreeSelection";
import { FilesSearchResults } from "./FilesSearchResults";
import { FilesSidebarSearch } from "./FilesSidebarSearch";
import { FilesSidebarTreeSection } from "./FilesSidebarTreeSection";
import { FilesCreateActions, FilesWorkspaceActions, FilesWorkspaceEmpty } from "./FilesWorkspaceActions";

export interface FilesSidebarProps {
  isCreatingFile: boolean;
  isCreatingFolder: boolean;
  isCreatingWorkspace: boolean;
  isSearching: boolean;
  isOpeningWorkspace: boolean;
  onCreateFile: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  onCreateFileInFolder?: (folderPath: string) => void;
  onCreateFolder: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  onCreateFolderInFolder?: (folderPath: string) => void;
  onCreateWorkspace: () => void;
  onDeleteItem: (path: string, type: WorkspaceTreeNode["type"]) => void;
  onDeleteItems: (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>) => void;
  onDuplicateFile: (path: string) => void;
  onMoveFile: (path: string, destFolder: string) => void;
  onMoveFolder: (path: string, destFolder: string) => void;
  onMoveItems: (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>, destFolder: string) => void;
  onOpenFile: (path: string, event?: React.MouseEvent<HTMLButtonElement>) => void;
  onOpenInOtherPane?: (path: string) => void;
  onOpenWorkspace: () => void;
  onRevealItem?: (path: string) => void;
  onRenameItem: (path: string, type: WorkspaceTreeNode["type"], newName: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onSelectedCountChange?: (count: number) => void;
  onSearchFrontmatterFieldChange: (field: string) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onSearchQueryChange: (query: string) => void;
  onTogglePin: (path: string) => void;
  openFilePaths?: Set<string>;
  searchError: string | null;
  searchFocusRequest: number;
  searchFrontmatterCandidates: Record<string, string[]>;
  searchFrontmatterField: string;
  searchFrontmatterFields: string[];
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
  onMoveFile,
  onMoveFolder,
  onMoveItems,
  onOpenFile,
  onOpenInOtherPane,
  onOpenWorkspace,
  onRevealItem,
  onRenameItem,
  onSelectFolder,
  onSelectedCountChange,
  onSearchFrontmatterFieldChange,
  onSearchModeChange,
  onSearchQueryChange,
  onTogglePin,
  openFilePaths,
  searchError,
  searchFocusRequest,
  searchFrontmatterCandidates,
  searchFrontmatterField,
  searchFrontmatterFields,
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
    <div className="sidebar-section">
      {activeWorkspace ? (
        <>
          <FilesSidebarSearch
            onSearchFrontmatterFieldChange={onSearchFrontmatterFieldChange}
            onSearchModeChange={onSearchModeChange}
            onSearchQueryChange={onSearchQueryChange}
            searchError={searchError}
            searchFocusRequest={searchFocusRequest}
            searchFrontmatterCandidates={searchFrontmatterCandidates}
            searchFrontmatterField={searchFrontmatterField}
            searchFrontmatterFields={searchFrontmatterFields}
            searchMode={searchMode}
            searchQuery={searchQuery}
          />
          <FilesCreateActions
            isCreatingFile={isCreatingFile}
            isCreatingFolder={isCreatingFolder}
            onCollapseAllFolders={() => requestExpansion("collapse")}
            onCreateFile={onCreateFile}
            onCreateFolder={onCreateFolder}
            onExpandAllFolders={() => requestExpansion("expand")}
          />
          {isFilteringFiles ? (
            <FilesSearchResults
              error={searchError}
              frontmatterField={searchFrontmatterField}
              isSearching={isSearching}
              mode={searchMode}
              onOpenFile={onOpenFile}
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
              openFilePaths={openFilePaths}
              pinnedPaths={pinnedPaths}
              selectedItems={selectedItems}
              selectedPaths={selectedPaths}
              workspaceState={workspaceState}
            />
          ) : null}
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
