import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import type { TranslationKey } from "../i18n";
import type { PanelTabKind } from "../store/editorStore";
import type { SidebarView } from "../store/uiStore";

export const IconFiles = ({ sidebarOpen = false }: { sidebarOpen?: boolean } = {}): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <path d="M3 5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" />
    {sidebarOpen ? (
      <polyline points="12.75,8.75 10.25,11 12.75,13.25" />
    ) : (
      <polyline points="10.75,8.75 13.25,11 10.75,13.25" />
    )}
  </svg>
);

const IconTools = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <path d="M15 3a3.5 3.5 0 0 0-3.2 4.9L4.1 15.5a1.5 1.5 0 0 0 2.1 2.1l7.6-7.7A3.5 3.5 0 0 0 18.5 6.5L16 9l-2-2 2.5-2.5A3.5 3.5 0 0 0 15 3z" />
  </svg>
);

const IconFrontmatter = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <rect height="14" rx="2" width="12" x="4" y="3" />
    <line x1="7" x2="13" y1="7" y2="7" />
    <line x1="7" x2="11" y1="10" y2="10" />
    <line x1="7" x2="12" y1="13" y2="13" />
  </svg>
);

const IconChronicle = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <line x1="3" x2="17" y1="10" y2="10" />
    <circle cx="6" cy="10" r="2" />
    <rect height="4" rx="1.5" width="7" x="10" y="8" />
    <line x1="6" x2="6" y1="5" y2="15" />
    <line x1="13.5" x2="13.5" y1="5" y2="15" />
  </svg>
);

const IconGraph = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <circle cx="5" cy="6" r="2" />
    <circle cx="14" cy="4" r="2" />
    <circle cx="15" cy="14" r="2" />
    <circle cx="6" cy="15" r="2" />
    <line x1="6.7" x2="12.2" y1="5.6" y2="4.4" />
    <line x1="14.3" x2="14.8" y1="6" y2="12" />
    <line x1="13.2" x2="7.8" y1="14.3" y2="14.8" />
    <line x1="6.2" x2="13.8" y1="7.5" y2="12.5" />
  </svg>
);

const IconDashboard = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <rect height="5" rx="1.4" width="5" x="3" y="3" />
    <rect height="5" rx="1.4" width="5" x="12" y="3" />
    <rect height="5" rx="1.4" width="5" x="3" y="12" />
    <path d="M12 16l1.5-3 1.7 2 1.8-4" />
  </svg>
);

const IconSettings = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <line x1="3" x2="17" y1="5" y2="5" />
    <line x1="3" x2="17" y1="10" y2="10" />
    <line x1="3" x2="17" y1="15" y2="15" />
    <circle cx="7" cy="5" fill="currentColor" r="2" stroke="none" />
    <circle cx="13" cy="10" fill="currentColor" r="2" stroke="none" />
    <circle cx="7" cy="15" fill="currentColor" r="2" stroke="none" />
  </svg>
);

type RailViewId = SidebarView | PanelTabKind;

export const sidebarViewDefs: Array<{ id: RailViewId; labelKey: TranslationKey; icon: ReactElement }> = [
  { id: "files", labelKey: "nav.files", icon: <IconFiles /> },
  { id: "dashboard", labelKey: "nav.dashboard", icon: <IconDashboard /> },
  { id: "graph", labelKey: "nav.graph", icon: <IconGraph /> },
  { id: "tools", labelKey: "nav.tools", icon: <IconTools /> },
  { id: "frontmatter", labelKey: "nav.frontmatter", icon: <IconFrontmatter /> },
  { id: "chronicle", labelKey: "nav.chronicle", icon: <IconChronicle /> },
  { id: "settings", labelKey: "nav.settings", icon: <IconSettings /> }
];

export function fixedMenuPosition(x: number, y: number, estimatedHeight = 240): { x: number; y: number } {
  const margin = 8;
  const estimatedWidth = 220;
  const maxX = Math.max(margin, window.innerWidth - estimatedWidth - margin);
  const maxY = Math.max(margin, window.innerHeight - estimatedHeight - margin);

  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY)
  };
}

interface RailWorkspaceSwitcherProps {
  activeWorkspaceId: string | null;
  ariaLabel: string;
  onRenameActiveChange?: (isActive: boolean) => void;
  onRenameComplete?: () => void;
  onRemoveWorkspace: (id: string) => void;
  onRenameWorkspace: (id: string, currentName: string) => Promise<boolean>;
  onSwitchWorkspace: (id: string) => void;
  renameLabel: string;
  removeLabel: (name: string) => string;
  workspaces: WorkspaceState["workspaces"];
}

export function RailWorkspaceSwitcher({
  activeWorkspaceId,
  ariaLabel,
  onRenameActiveChange,
  onRenameComplete,
  onRemoveWorkspace,
  onRenameWorkspace,
  onSwitchWorkspace,
  renameLabel,
  removeLabel,
  workspaces
}: RailWorkspaceSwitcherProps): ReactElement | null {
  const [contextMenu, setContextMenu] = useState<{ workspaceId: string; name: string; x: number; y: number } | null>(null);
  const [renamingWorkspace, setRenamingWorkspace] = useState<{ id: string; name: string; value: string } | null>(null);
  const [isComposingRename, setIsComposingRename] = useState(false);
  const isCommittingRenameRef = useRef(false);
  const skipNextRenameEnterKeyUpRef = useRef(false);
  const isRenamingWorkspace = renamingWorkspace !== null;

  useEffect(() => {
    onRenameActiveChange?.(isRenamingWorkspace);
  }, [isRenamingWorkspace, onRenameActiveChange]);

  useEffect(() => {
    return () => onRenameActiveChange?.(false);
  }, [onRenameActiveChange]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = (): void => setContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("click", close);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  if (workspaces.length === 0) return null;

  const startRename = (workspaceId: string, name: string): void => {
    setContextMenu(null);
    isCommittingRenameRef.current = false;
    skipNextRenameEnterKeyUpRef.current = false;
    setRenamingWorkspace({ id: workspaceId, name, value: name });
  };

  const commitRename = async (value = renamingWorkspace?.value ?? ""): Promise<void> => {
    if (!renamingWorkspace) return;
    if (isCommittingRenameRef.current) return;

    const nextName = value.trim();
    const previousName = renamingWorkspace.name;
    const workspaceId = renamingWorkspace.id;
    isCommittingRenameRef.current = true;

    if (!nextName || nextName === previousName) {
      setRenamingWorkspace(null);
      return;
    }

    await onRenameWorkspace(workspaceId, nextName);
    onRenameComplete?.();
    setRenamingWorkspace(null);
  };

  const cancelRename = (): void => {
    setIsComposingRename(false);
    isCommittingRenameRef.current = false;
    skipNextRenameEnterKeyUpRef.current = false;
    setRenamingWorkspace(null);
  };

  return (
    <div className="workspace-switcher" aria-label={ariaLabel}>
      {workspaces.map((ws) => {
        const isActive = ws.id === activeWorkspaceId;
        const isRenaming = renamingWorkspace?.id === ws.id;
        const initial = ws.name.trim().charAt(0).toUpperCase() || "W";

        return (
          <div className={`workspace-switcher-item${isActive ? " active" : ""}`} key={ws.id}>
            {isRenaming ? (
              <div className="workspace-switcher-main workspace-switcher-main--editing">
                <span className="workspace-switcher-icon">{initial}</span>
                <input
                  aria-label={renameLabel}
                  autoFocus
                  className="workspace-switcher-input"
                  onBlur={(event) => {
                    void commitRename(event.currentTarget.value);
                  }}
                  onChange={(event) => {
                    setRenamingWorkspace((current) => (
                      current && current.id === ws.id
                        ? { ...current, value: event.target.value }
                        : current
                    ));
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onCompositionEnd={() => setIsComposingRename(false)}
                  onCompositionStart={() => setIsComposingRename(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      if (isComposingRename || event.nativeEvent.isComposing) {
                        skipNextRenameEnterKeyUpRef.current = true;
                        return;
                      }
                      event.preventDefault();
                      void commitRename(event.currentTarget.value);
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelRename();
                    }
                  }}
                  onKeyUp={(event) => {
                    if (event.key !== "Enter") return;
                    if (skipNextRenameEnterKeyUpRef.current) {
                      skipNextRenameEnterKeyUpRef.current = false;
                      return;
                    }
                    if (isComposingRename || event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    void commitRename(event.currentTarget.value);
                  }}
                  value={renamingWorkspace.value}
                />
              </div>
            ) : (
              <button
                aria-label={ws.name}
                className="workspace-switcher-main"
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setContextMenu({ name: ws.name, workspaceId: ws.id, ...fixedMenuPosition(event.clientX, event.clientY, 96) });
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  startRename(ws.id, ws.name);
                }}
                onClick={() => onSwitchWorkspace(ws.id)}
                title={ws.path}
                type="button"
              >
                <span className="workspace-switcher-icon">{initial}</span>
                <span className="workspace-switcher-name">{ws.name}</span>
              </button>
            )}
            <button
              aria-label={removeLabel(ws.name)}
              className="workspace-switcher-remove"
              onClick={() => onRemoveWorkspace(ws.id)}
              title={removeLabel(ws.name)}
              type="button"
            >
              ×
            </button>
          </div>
        );
      })}
      {contextMenu ? (
        <div
          className="tab-context-menu workspace-context-menu"
          onClick={(event) => event.stopPropagation()}
          role="menu"
          style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 1000 }}
        >
          <button
            className="tab-context-menu-item"
            onClick={() => {
              startRename(contextMenu.workspaceId, contextMenu.name);
              setContextMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            {renameLabel}
          </button>
          <button
            className="tab-context-menu-item danger"
            onClick={() => {
              onRemoveWorkspace(contextMenu.workspaceId);
              setContextMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            {removeLabel(contextMenu.name)}
          </button>
        </div>
      ) : null}
    </div>
  );
}
