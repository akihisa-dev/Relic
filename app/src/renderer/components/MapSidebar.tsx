import { useMemo, type MouseEvent as ReactMouseEvent, type ReactElement } from "react";

import type { WorkspaceFileIndexEntry, WorkspaceState } from "../../shared/ipc";
import { useT } from "../i18n";
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
  const activeWorkspace = workspaceState?.activeWorkspace ?? null;
  const { mapFiles, placeableFiles } = useMemo(
    () => groupMapSidebarFiles(workspaceState?.fileIndex ?? []),
    [workspaceState?.fileIndex]
  );

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
        title={t("map.placeableFiles")}
      />
    </div>
  );
}

function MapSidebarGroup({
  emptyLabel,
  files,
  onOpenFile,
  openingFilePath,
  openFilePaths,
  title
}: {
  emptyLabel: string;
  files: WorkspaceFileIndexEntry[];
  onOpenFile?: MapSidebarProps["onOpenFile"];
  openingFilePath?: string | null;
  openFilePaths?: Set<string>;
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
