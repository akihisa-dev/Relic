import { useEffect, useState } from "react";
import type { CSSProperties, Dispatch, ReactElement, SetStateAction } from "react";

import type { AliasIndex } from "../../shared/links";
import type { AppLinkContextMenu } from "../appLinks";
import { writeEditorClipboardText } from "../editorClipboard";
import type { RailTabFlight, SidebarCreateFlight } from "../hooks/useRailFlights";
import { useT } from "../i18n";
import { selectedUiTextForContextMenu, type UiSelectionContextMenuState } from "../uiSelectionContextMenu";
import type { Command } from "./CommandPalette";
import { CommandPalette } from "./CommandPalette";
import { PagePreviewPopover } from "./PagePreviewPopover";
import { QuickSwitcher } from "./QuickSwitcher";
import { fixedMenuPosition } from "./railNavigationModel";

export interface ToastMessage {
  text: string;
  type: "error" | "info";
}

interface AppOverlaysProps {
  aliasesByPath: AliasIndex;
  closeToast: () => void;
  commands: Command[];
  existingMarkdownPaths: string[];
  handleOpenFile: (path: string) => void;
  handleOpenWikiLink: (target: string, heading?: string) => void;
  handleRevealWorkspaceItem: (path: string) => void;
  isSplit: boolean;
  isToastClosing: boolean;
  linkContextMenu: AppLinkContextMenu | null;
  openWorkspacePathInOtherPane: (path: string, heading?: string) => void;
  railTabFlight: RailTabFlight | null;
  setLinkContextMenu: Dispatch<SetStateAction<AppLinkContextMenu | null>>;
  setShowCommandPalette: (isShown: boolean) => void;
  setShowQuickSwitcher: (isShown: boolean) => void;
  showCommandPalette: boolean;
  showQuickSwitcher: boolean;
  sidebarCreateFlight: SidebarCreateFlight | null;
  toastMessage: ToastMessage | null;
}

export function AppOverlays({
  aliasesByPath,
  closeToast,
  commands,
  existingMarkdownPaths,
  handleOpenFile,
  handleOpenWikiLink,
  handleRevealWorkspaceItem,
  isSplit,
  isToastClosing,
  linkContextMenu,
  openWorkspacePathInOtherPane,
  railTabFlight,
  setLinkContextMenu,
  setShowCommandPalette,
  setShowQuickSwitcher,
  showCommandPalette,
  showQuickSwitcher,
  sidebarCreateFlight,
  toastMessage
}: AppOverlaysProps): ReactElement {
  const t = useT();
  const [selectionContextMenu, setSelectionContextMenu] = useState<UiSelectionContextMenuState | null>(null);

  useEffect(() => {
    if (!linkContextMenu) return;
    const close = (): void => setLinkContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("click", close);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [linkContextMenu, setLinkContextMenu]);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent): void => {
      const text = selectedUiTextForContextMenu(event, window.getSelection());
      if (!text) {
        setSelectionContextMenu(null);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setLinkContextMenu(null);
      setSelectionContextMenu({
        text,
        ...fixedMenuPosition(event.clientX, event.clientY, 48)
      });
    };
    const close = (): void => setSelectionContextMenu(null);
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Element && target.closest(".ui-selection-context-menu")) return;
      close();
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("contextmenu", handleContextMenu, true);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu, true);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setLinkContextMenu]);

  return (
    <>
      {railTabFlight ? (
        <div
          className={`rail-tab-flight rail-tab-flight--${railTabFlight.direction}`}
          style={{
            "--rail-tab-flight-from-x": `${railTabFlight.fromX}px`,
            "--rail-tab-flight-from-y": `${railTabFlight.fromY}px`,
            "--rail-tab-flight-to-x": `${railTabFlight.toX}px`,
            "--rail-tab-flight-to-y": `${railTabFlight.toY}px`
          } as CSSProperties}
        >
          {railTabFlight.label}
        </div>
      ) : null}

      {sidebarCreateFlight ? (
        <div
          className="sidebar-create-flight"
          style={{
            "--sidebar-create-flight-from-x": `${sidebarCreateFlight.fromX}px`,
            "--sidebar-create-flight-from-y": `${sidebarCreateFlight.fromY}px`,
            "--sidebar-create-flight-to-x": `${sidebarCreateFlight.toX}px`,
            "--sidebar-create-flight-to-y": `${sidebarCreateFlight.toY}px`
          } as CSSProperties}
        >
          {sidebarCreateFlight.label}
        </div>
      ) : null}

      {showCommandPalette ? (
        <CommandPalette commands={commands} onClose={() => setShowCommandPalette(false)} />
      ) : null}

      {showQuickSwitcher ? (
        <QuickSwitcher
          aliasesByPath={aliasesByPath}
          filePaths={existingMarkdownPaths}
          onClose={() => setShowQuickSwitcher(false)}
          onSelect={handleOpenFile}
        />
      ) : null}

      <PagePreviewPopover
        aliasesByPath={aliasesByPath}
        existingMarkdownPaths={existingMarkdownPaths}
      />

      {linkContextMenu ? (
        <div
          className="tab-context-menu link-context-menu"
          onClick={(event) => event.stopPropagation()}
          role="menu"
          style={{ left: linkContextMenu.x, position: "fixed", top: linkContextMenu.y, zIndex: 40 }}
          tabIndex={-1}
        >
          <button
            className="tab-context-menu-item"
            onClick={() => {
              if (linkContextMenu.openKind === "wiki" && linkContextMenu.target) {
                handleOpenWikiLink(linkContextMenu.target, linkContextMenu.heading);
              } else {
                handleOpenFile(linkContextMenu.path);
              }
              setLinkContextMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            {t("files.open")}
          </button>
          {isSplit ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                openWorkspacePathInOtherPane(linkContextMenu.path, linkContextMenu.heading);
                setLinkContextMenu(null);
              }}
              role="menuitem"
              type="button"
            >
              {t("pane.openInOtherPane")}
            </button>
          ) : null}
          <button
            className="tab-context-menu-item"
            onClick={() => {
              void writeEditorClipboardText(linkContextMenu.markdownLink).catch(() => undefined);
              setLinkContextMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            {t("files.copyMarkdownLink")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => {
              void writeEditorClipboardText(linkContextMenu.path).catch(() => undefined);
              setLinkContextMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            {t("files.copyPath")}
          </button>
          {linkContextMenu.exists ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                handleRevealWorkspaceItem(linkContextMenu.path);
                setLinkContextMenu(null);
              }}
              role="menuitem"
              type="button"
            >
              {t("files.revealInFinder")}
            </button>
          ) : null}
        </div>
      ) : null}

      {selectionContextMenu ? (
        <div
          className="tab-context-menu ui-selection-context-menu"
          onClick={(event) => event.stopPropagation()}
          role="menu"
          style={{ left: selectionContextMenu.x, position: "fixed", top: selectionContextMenu.y, zIndex: 40 }}
          tabIndex={-1}
        >
          <button
            className="tab-context-menu-item"
            onClick={() => {
              void writeEditorClipboardText(selectionContextMenu.text);
              setSelectionContextMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            {t("editor.copy")}
          </button>
        </div>
      ) : null}

      {toastMessage ? (
        <div className={`toast toast--${toastMessage.type}${isToastClosing ? " toast--closing" : ""}`} onClick={closeToast} role="presentation">
          {toastMessage.text}
        </div>
      ) : null}
    </>
  );
}
