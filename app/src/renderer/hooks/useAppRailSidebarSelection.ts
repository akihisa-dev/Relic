import { useCallback } from "react";

import type { PaneId, PanelTabKind } from "../store/editorStore";
import type { SidebarView } from "../store/uiStore";

interface UseAppRailSidebarSelectionInput {
  focusedPane: PaneId;
  openPanelInPane: (pane: PaneId, panel: PanelTabKind, name: string) => void;
  openSecondarySidebar: (view: "ai-chat") => void;
  panelLabels: Record<PanelTabKind, string>;
  setSidebarView: (view: SidebarView) => void;
}

export function useAppRailSidebarSelection({
  focusedPane,
  openPanelInPane,
  openSecondarySidebar,
  panelLabels,
  setSidebarView
}: UseAppRailSidebarSelectionInput): (view: SidebarView) => void {
  return useCallback((view: SidebarView): void => {
    if (view === "tools" || view === "frontmatter" || view === "settings") {
      openPanelInPane(focusedPane, view, panelLabels[view]);
      setSidebarView("files");
      return;
    }

    if (view === "ai") {
      openSecondarySidebar("ai-chat");
    }

    setSidebarView(view);
  }, [focusedPane, openPanelInPane, openSecondarySidebar, panelLabels, setSidebarView]);
}
