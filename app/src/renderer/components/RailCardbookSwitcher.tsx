import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { CardbookState } from "../../shared/ipc";
import { fixedMenuPosition } from "./railNavigationModel";

interface RailCardbookSwitcherProps {
  activeCardbookId: string | null;
  ariaLabel: string;
  onRenameActiveChange?: (isActive: boolean) => void;
  onRenameComplete?: () => void;
  onRemoveCardbook: (id: string) => void;
  onRenameCardbook: (id: string, currentName: string) => Promise<boolean>;
  onSwitchCardbook: (id: string) => void;
  renameLabel: string;
  removeLabel: (name: string) => string;
  cardbooks: CardbookState["cardbooks"];
}

export function RailCardbookSwitcher({
  activeCardbookId,
  ariaLabel,
  onRenameActiveChange,
  onRenameComplete,
  onRemoveCardbook,
  onRenameCardbook,
  onSwitchCardbook,
  renameLabel,
  removeLabel,
  cardbooks
}: RailCardbookSwitcherProps): ReactElement | null {
  const [contextMenu, setContextMenu] = useState<{ cardbookId: string; name: string; x: number; y: number } | null>(null);
  const [renamingCardbook, setRenamingCardbook] = useState<{ id: string; name: string; value: string } | null>(null);
  const [isComposingRename, setIsComposingRename] = useState(false);
  const isCommittingRenameRef = useRef(false);
  const skipNextRenameEnterKeyUpRef = useRef(false);
  const isRenamingCardbook = renamingCardbook !== null;

  useEffect(() => {
    onRenameActiveChange?.(isRenamingCardbook);
  }, [isRenamingCardbook, onRenameActiveChange]);

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

  if (cardbooks.length === 0) return null;

  const startRename = (cardbookId: string, name: string): void => {
    setContextMenu(null);
    isCommittingRenameRef.current = false;
    skipNextRenameEnterKeyUpRef.current = false;
    setRenamingCardbook({ id: cardbookId, name, value: name });
  };

  const commitRename = async (value = renamingCardbook?.value ?? ""): Promise<void> => {
    if (!renamingCardbook) return;
    if (isCommittingRenameRef.current) return;

    const nextName = value.trim();
    const previousName = renamingCardbook.name;
    const cardbookId = renamingCardbook.id;
    isCommittingRenameRef.current = true;

    if (!nextName || nextName === previousName) {
      setRenamingCardbook(null);
      return;
    }

    await onRenameCardbook(cardbookId, nextName);
    onRenameComplete?.();
    setRenamingCardbook(null);
  };

  const cancelRename = (): void => {
    setIsComposingRename(false);
    isCommittingRenameRef.current = false;
    skipNextRenameEnterKeyUpRef.current = false;
    setRenamingCardbook(null);
  };

  return (
    <div className="cardbook-switcher" aria-label={ariaLabel}>
      {cardbooks.map((ws) => {
        const isActive = ws.id === activeCardbookId;
        const isRenaming = renamingCardbook?.id === ws.id;
        const initial = ws.name.trim().charAt(0).toUpperCase() || "W";

        return (
          <div className={`cardbook-switcher-item${isActive ? " active" : ""}`} key={ws.id}>
            {isRenaming ? (
              <div className="cardbook-switcher-main cardbook-switcher-main--editing">
                <span className="cardbook-switcher-icon">{initial}</span>
                <input
                  aria-label={renameLabel}
                  autoFocus
                  className="cardbook-switcher-input"
                  onBlur={(event) => {
                    void commitRename(event.currentTarget.value);
                  }}
                  onChange={(event) => {
                    setRenamingCardbook((current) => (
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
                  value={renamingCardbook.value}
                />
              </div>
            ) : (
              <button
                aria-label={ws.name}
                className="cardbook-switcher-main"
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setContextMenu({ name: ws.name, cardbookId: ws.id, ...fixedMenuPosition(event.clientX, event.clientY, 96) });
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  startRename(ws.id, ws.name);
                }}
                onClick={() => onSwitchCardbook(ws.id)}
                title={ws.path}
                type="button"
              >
                <span className="cardbook-switcher-icon">{initial}</span>
                <span className="cardbook-switcher-name">{ws.name}</span>
              </button>
            )}
            <button
              aria-label={removeLabel(ws.name)}
              className="cardbook-switcher-remove"
              onClick={() => onRemoveCardbook(ws.id)}
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
          className="tab-context-menu cardbook-context-menu"
          onClick={(event) => event.stopPropagation()}
          role="menu"
          style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 1000 }}
        >
          <button
            className="tab-context-menu-item"
            onClick={() => {
              startRename(contextMenu.cardbookId, contextMenu.name);
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
              onRemoveCardbook(contextMenu.cardbookId);
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
