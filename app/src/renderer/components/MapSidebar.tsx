import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactElement } from "react";
import { createPortal } from "react-dom";

import type { WorkspaceFileIndexEntry, WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import { addRelicMapNodeForFile, isRelicMapMarkdownContent } from "../../shared/mapMarkdown";
import { useT } from "../i18n";
import { useEditorStore } from "../store/editorStore";
import { FilesWorkspaceEmpty } from "./FilesWorkspaceActions";

interface MapSidebarProps {
  isCreatingFile: boolean;
  isCreatingWorkspace: boolean;
  isOpeningWorkspace: boolean;
  onCreateMapFile: () => void;
  onCreateWorkspace: () => void;
  onDeleteItem?: (path: string, type: WorkspaceTreeNode["type"]) => void;
  onOpenFile: (path: string, event?: ReactMouseEvent<HTMLButtonElement>, options?: { lineNumber?: number | null }) => void;
  onOpenWorkspace: () => void;
  openingFilePath?: string | null;
  openFilePaths?: Set<string>;
  workspaceState: WorkspaceState | null;
}

export function MapSidebar({
  isCreatingFile,
  isCreatingWorkspace,
  isOpeningWorkspace,
  onCreateMapFile,
  onCreateWorkspace,
  onDeleteItem,
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
      <div className="map-sidebar-actions">
        <button
          aria-label={t("map.createMap")}
          className="files-create-icon-button"
          data-tooltip={t("map.createMap")}
          disabled={isCreatingFile}
          onClick={onCreateMapFile}
          title={t("map.createMap")}
          type="button"
        >
          <MapFileIcon />
        </button>
      </div>
      <MapSidebarGroup
        emptyLabel={t("map.noMapFiles")}
        files={mapFiles}
        onDeleteItem={onDeleteItem}
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

function MapFileIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="22">
      <path d="M4.5 5.25v13.5l4.5-2.25 6 2.25 4.5-2.25V3l-4.5 2.25-6-2.25-4.5 2.25Z" />
      <path d="M9 3v13.5" />
      <path d="M15 5.25v13.5" />
    </svg>
  );
}

function MapSidebarGroup({
  emptyLabel,
  files,
  onOpenFile,
  onDeleteItem,
  onPlaceFile,
  openingFilePath,
  openFilePaths,
  placeDisabled = false,
  title
}: {
  emptyLabel: string;
  files: WorkspaceFileIndexEntry[];
  onOpenFile?: MapSidebarProps["onOpenFile"];
  onDeleteItem?: MapSidebarProps["onDeleteItem"];
  onPlaceFile?: (path: string) => void;
  openingFilePath?: string | null;
  openFilePaths?: Set<string>;
  placeDisabled?: boolean;
  title: string;
}): ReactElement {
  const [contextMenu, setContextMenu] = useState<{ file: WorkspaceFileIndexEntry; x: number; y: number } | null>(null);
  const closeContextMenu = (): void => setContextMenu(null);
  const openContextMenu = (file: WorkspaceFileIndexEntry, event: ReactMouseEvent<HTMLButtonElement>): void => {
    if (!onDeleteItem) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ file, x: event.clientX, y: event.clientY });
  };

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
                  onContextMenu={(event) => openContextMenu(file, event)}
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
      {contextMenu && onDeleteItem ? (
        <MapSidebarFileContextMenu
          file={contextMenu.file}
          onClose={closeContextMenu}
          onDeleteItem={onDeleteItem}
          x={contextMenu.x}
          y={contextMenu.y}
        />
      ) : null}
    </section>
  );
}

function MapSidebarFileContextMenu({
  file,
  onClose,
  onDeleteItem,
  x,
  y
}: {
  file: WorkspaceFileIndexEntry;
  onClose: () => void;
  onDeleteItem: NonNullable<MapSidebarProps["onDeleteItem"]>;
  x: number;
  y: number;
}): ReactElement {
  const t = useT();
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const close = (event: PointerEvent): void => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="tab-context-menu file-tree-context-menu"
      ref={menuRef}
      role="menu"
      style={{ left: x, position: "fixed", top: y, zIndex: 40 }}
    >
      <button
        className="tab-context-menu-item tab-context-menu-item--icon danger"
        onClick={() => {
          onClose();
          onDeleteItem(file.path, "file");
        }}
        role="menuitem"
        type="button"
      >
        <TrashIcon />
        {t("files.moveToTrash")}
      </button>
    </div>,
    document.body
  );
}

function TrashIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="tab-context-menu-icon" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
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
