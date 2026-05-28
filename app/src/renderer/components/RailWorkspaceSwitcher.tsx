import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import { fixedMenuPosition } from "./railNavigationModel";

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
          style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 40 }}
          tabIndex={-1}
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
