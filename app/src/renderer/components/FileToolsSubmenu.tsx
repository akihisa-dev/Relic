import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from "react";

import type { ToolTarget } from "../../shared/ipc";
import type { FileToolActionId } from "../fileTreeTypes";
import { useT } from "../i18n";

interface FileToolsSubmenuProps {
  disabledReason?: string;
  onClose: () => void;
  onRun?: (toolId: FileToolActionId, target: ToolTarget) => void;
  runningTool?: FileToolActionId | null;
  target: ToolTarget | null;
}

const actions: Array<{ id: FileToolActionId; label: "tools.titleListAction" | "tools.tocAction" | "tools.tagIndexAction" | "tools.mergeFilesAction" }> = [
  { id: "titleList", label: "tools.titleListAction" },
  { id: "toc", label: "tools.tocAction" },
  { id: "tagIndex", label: "tools.tagIndexAction" },
  { id: "mergeFiles", label: "tools.mergeFilesAction" }
];

export function FileToolsSubmenu({ disabledReason, onClose, onRun, runningTool = null, target }: FileToolsSubmenuProps): ReactElement {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState("");
  const submenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusFirstOnOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !submenuRef.current) return;
    const rect = submenuRef.current.getBoundingClientRect();
    setPlacement(`${rect.right > window.innerWidth - 8 ? " file-tools-submenu--left" : ""}${rect.bottom > window.innerHeight - 8 ? " file-tools-submenu--up" : ""}`);
    if (focusFirstOnOpenRef.current) {
      focusFirstOnOpenRef.current = false;
      submenuRef.current.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }, [isOpen]);

  const openFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if ((event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") && target && !disabledReason) {
      event.preventDefault();
      focusFirstOnOpenRef.current = true;
      setIsOpen(true);
    }
  };

  return (
    <div className="file-tools-submenu-anchor" onMouseLeave={() => setIsOpen(false)}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="tab-context-menu-item file-tools-submenu-trigger"
        disabled={!target || Boolean(disabledReason)}
        onClick={() => setIsOpen((value) => !value)}
        onKeyDown={openFromKeyboard}
        onMouseEnter={() => target && !disabledReason && setIsOpen(true)}
        ref={triggerRef}
        role="menuitem"
        type="button"
      >
        <span>{t("tools.tools")}</span><span aria-hidden="true">›</span>
      </button>
      {disabledReason ? <div className="file-tools-disabled-reason">{disabledReason}</div> : null}
      {isOpen && target ? (
        <div
          className={`tab-context-menu file-tools-submenu${placement}`}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "Escape") {
              event.preventDefault();
              setIsOpen(false);
              triggerRef.current?.focus();
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
              event.preventDefault();
              const buttons = [...(submenuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
              if (buttons.length === 0) return;
              const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
              const nextIndex = event.key === "Home"
                ? 0
                : event.key === "End"
                  ? buttons.length - 1
                  : event.key === "ArrowDown"
                    ? (currentIndex + 1 + buttons.length) % buttons.length
                    : (currentIndex - 1 + buttons.length) % buttons.length;
              buttons[nextIndex]?.focus();
            }
          }}
          ref={submenuRef}
          role="menu"
        >
          {actions.map((action) => (
            <button
              className="tab-context-menu-item"
              disabled={runningTool !== null}
              key={action.id}
              onClick={() => {
                onClose();
                onRun?.(action.id, target);
              }}
              role="menuitem"
              type="button"
            >
              {runningTool === action.id ? t("common.running") : t(action.label)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
