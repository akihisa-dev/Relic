import { useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactElement } from "react";

import type { WorkspaceFileIndexEntry, WorkspaceState } from "../../shared/ipc";
import { addRelicMapNodeForFile, isRelicMapMarkdownContent } from "../../shared/mapMarkdown";
import { useT } from "../i18n";
import { useEditorStore } from "../store/editorStore";
import { FilesWorkspaceEmpty } from "./FilesWorkspaceActions";

interface MapSidebarProps {
  isCreatingWorkspace: boolean;
  isOpeningWorkspace: boolean;
  onCreateWorkspace: () => void;
  onOpenFile: (path: string, event?: ReactMouseEvent<HTMLButtonElement>, options?: { lineNumber?: number | null }) => void;
  onOpenWorkspace: () => void;
  openingFilePath?: string | null;
  openFilePaths?: Set<string>;
  workspaceState: WorkspaceState | null;
}

export function MapSidebar({
  isCreatingWorkspace,
  isOpeningWorkspace,
  onCreateWorkspace,
  onOpenFile,
  onOpenWorkspace,
  openingFilePath,
  openFilePaths,
  workspaceState
}: MapSidebarProps): ReactElement {
  const t = useT();
  const [placementError, setPlacementError] = useState<string | null>(null);
  const focusedPane = useEditorStore((state) => state.focusedPane);
  const leftPane = useEditorStore((state) => state.leftPane);
  const rightPane = useEditorStore((state) => state.rightPane);
  const tabs = useEditorStore((state) => state.tabs);
  const updateTabContent = useEditorStore((state) => state.updateTabContent);
  const activeWorkspace = workspaceState?.activeWorkspace ?? null;
  const { mapFiles, placeableFiles } = useMemo(
    () => groupMapSidebarFiles(workspaceState?.fileIndex ?? []),
    [workspaceState?.fileIndex]
  );
  const activePane = focusedPane === "right" ? rightPane : leftPane;
  const activeTab = activePane.activeTabId ? tabs[activePane.activeTabId] : null;
  const activeMapTab = activeTab?.kind === "file" && isRelicMapMarkdownContent(activeTab.content) ? activeTab : null;
  const handlePlaceFile = (filePath: string): void => {
    if (!activeMapTab) {
      setPlacementError(t("map.openMapFirst"));
      return;
    }

    const next = addRelicMapNodeForFile(activeMapTab.content, filePath);
    if (!next.ok) {
      setPlacementError(next.error.message);
      return;
    }

    setPlacementError(null);
    updateTabContent(activeMapTab.id, next.value.content);
  };

  if (!activeWorkspace) {
    return (
      <div className="sidebar-section">
        <FilesWorkspaceEmpty
          isCreatingWorkspace={isCreatingWorkspace}
          isOpeningWorkspace={isOpeningWorkspace}
          onCreateWorkspace={onCreateWorkspace}
          onOpenWorkspace={onOpenWorkspace}
        />
      </div>
    );
  }

  return (
    <div className="map-sidebar-section">
      <MapSidebarGroup
        emptyLabel={t("map.noMapFiles")}
        files={mapFiles}
        onOpenFile={onOpenFile}
        openingFilePath={openingFilePath}
        openFilePaths={openFilePaths}
        title={t("map.files")}
      />
      <MapSidebarGroup
        emptyLabel={t("map.noPlaceableFiles")}
        files={placeableFiles}
        onPlaceFile={handlePlaceFile}
        placeDisabled={!activeMapTab}
        title={t("map.placeableFiles")}
      />
      {placementError ? (
        <output className="map-sidebar-error">{placementError}</output>
      ) : null}
    </div>
  );
}

function MapSidebarGroup({
  emptyLabel,
  files,
  onOpenFile,
  onPlaceFile,
  openingFilePath,
  openFilePaths,
  placeDisabled = false,
  title
}: {
  emptyLabel: string;
  files: WorkspaceFileIndexEntry[];
  onOpenFile?: MapSidebarProps["onOpenFile"];
  onPlaceFile?: (path: string) => void;
  openingFilePath?: string | null;
  openFilePaths?: Set<string>;
  placeDisabled?: boolean;
  title: string;
}): ReactElement {
  return (
    <section className="map-sidebar-group">
      <div className="map-sidebar-group-heading">
        <span>{title}</span>
        <span className="pane-heading-count">{files.length}</span>
      </div>
      {files.length > 0 ? (
        <ul className="map-sidebar-file-list">
          {files.map((file) => (
            <li key={file.path}>
              {onOpenFile ? (
                <button
                  className={`map-sidebar-file map-sidebar-file--button${openFilePaths?.has(file.path) ? " open" : ""}${openingFilePath === file.path ? " loading" : ""}`}
                  onClick={(event) => onOpenFile(file.path, event)}
                  title={file.path}
                  type="button"
                >
                  <span className="map-sidebar-file-name">{file.name}</span>
                  <span className="map-sidebar-file-path">{file.path}</span>
                </button>
              ) : onPlaceFile ? (
                <button
                  className="map-sidebar-file map-sidebar-file--button"
                  disabled={placeDisabled}
                  onClick={() => onPlaceFile(file.path)}
                  title={file.path}
                  type="button"
                >
                  <span className="map-sidebar-file-name">{file.name}</span>
                  <span className="map-sidebar-file-path">{file.path}</span>
                </button>
              ) : (
                <div className="map-sidebar-file" title={file.path}>
                  <span className="map-sidebar-file-name">{file.name}</span>
                  <span className="map-sidebar-file-path">{file.path}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="map-sidebar-empty">{emptyLabel}</p>
      )}
    </section>
  );
}

function groupMapSidebarFiles(fileIndex: WorkspaceFileIndexEntry[]): {
  mapFiles: WorkspaceFileIndexEntry[];
  placeableFiles: WorkspaceFileIndexEntry[];
} {
  const mapFiles: WorkspaceFileIndexEntry[] = [];
  const placeableFiles: WorkspaceFileIndexEntry[] = [];

  for (const file of fileIndex) {
    if (file.readStatus !== "ok") continue;
    if (file.kind === "map") {
      mapFiles.push(file);
    } else {
      placeableFiles.push(file);
    }
  }

  return {
    mapFiles: sortFilesForSidebar(mapFiles),
    placeableFiles: sortFilesForSidebar(placeableFiles)
  };
}

function sortFilesForSidebar(files: WorkspaceFileIndexEntry[]): WorkspaceFileIndexEntry[] {
  return files.toSorted((left, right) => left.path.localeCompare(right.path, "ja"));
}
