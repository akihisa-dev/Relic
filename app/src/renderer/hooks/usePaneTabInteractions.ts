import { useEffect, useState } from "react";
import type { DragEvent } from "react";

import {
  dataTransferHasPaneTab,
  paneTabDropPosition,
  readPaneTabDragPayload,
  serializePaneTabDragPayload,
  PANE_TAB_DRAG_MIME
} from "../paneViewModel";
import { contextMenuPosition } from "../fileTreeUi";
import type { PaneId } from "../store/editorStore";

export interface PaneTabDropTarget {
  position: "after" | "before";
  tabId: string | null;
}

export interface PaneTabContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

export function usePaneTabInteractions({
  onTabMove,
  pane
}: {
  onTabMove: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  pane: PaneId;
}): {
  closeContextMenu: () => void;
  contextMenu: PaneTabContextMenuState | null;
  handleTabBarDragLeave: (e: DragEvent<HTMLElement>) => void;
  handleTabBarDragOver: (e: DragEvent<HTMLElement>) => void;
  handleTabDragEnd: () => void;
  handleTabDragOver: (e: DragEvent<HTMLElement>, tabId: string) => void;
  handleTabDragStart: (e: DragEvent<HTMLElement>, tabId: string, isClosing: boolean) => void;
  handleTabDrop: (e: DragEvent<HTMLElement>, targetTabId?: string | null) => void;
  openContextMenu: (tabId: string, x: number, y: number) => void;
  tabDropTarget: PaneTabDropTarget | null;
} {
  const [contextMenu, setContextMenu] = useState<PaneTabContextMenuState | null>(null);
  const [tabDropTarget, setTabDropTarget] = useState<PaneTabDropTarget | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  const closeContextMenu = (): void => setContextMenu(null);

  const openContextMenu = (tabId: string, x: number, y: number): void => {
    setContextMenu({ tabId, ...contextMenuPosition(x, y) });
  };

  const handleTabDrop = (e: DragEvent<HTMLElement>, targetTabId?: string | null): void => {
    const draggedTab = readPaneTabDragPayload(e.dataTransfer);
    if (!draggedTab) return;

    e.preventDefault();
    e.stopPropagation();
    setTabDropTarget(null);
    onTabMove(
      draggedTab.fromPane,
      pane,
      draggedTab.tabId,
      targetTabId ?? null,
      targetTabId ? paneTabDropPosition(e.clientX, e.currentTarget.getBoundingClientRect()) : "after"
    );
  };

  const handleTabBarDragLeave = (e: DragEvent<HTMLElement>): void => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTabDropTarget(null);
  };

  const handleTabBarDragOver = (e: DragEvent<HTMLElement>): void => {
    if (!dataTransferHasPaneTab(e.dataTransfer.types)) return;
    e.preventDefault();
    if (e.target === e.currentTarget) {
      setTabDropTarget({ position: "after", tabId: null });
    }
  };

  const handleTabDragOver = (e: DragEvent<HTMLElement>, tabId: string): void => {
    if (!dataTransferHasPaneTab(e.dataTransfer.types)) return;
    e.preventDefault();
    e.stopPropagation();
    setTabDropTarget({
      position: paneTabDropPosition(e.clientX, e.currentTarget.getBoundingClientRect()),
      tabId
    });
  };

  const handleTabDragStart = (e: DragEvent<HTMLElement>, tabId: string, isClosing: boolean): void => {
    if (isClosing) return;
    e.dataTransfer.setData(PANE_TAB_DRAG_MIME, serializePaneTabDragPayload({ fromPane: pane, tabId }));
    e.dataTransfer.effectAllowed = "move";
  };

  return {
    closeContextMenu,
    contextMenu,
    handleTabBarDragLeave,
    handleTabBarDragOver,
    handleTabDragEnd: () => setTabDropTarget(null),
    handleTabDragOver,
    handleTabDragStart,
    handleTabDrop,
    openContextMenu,
    tabDropTarget
  };
}
