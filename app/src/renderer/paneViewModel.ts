import type { Translator } from "./i18n";
import type { PaneId, PanelTabKind, Tab } from "./store/editorStore";

export const PANE_TAB_DRAG_MIME = "application/relic-tab";

export interface PaneTabDragPayload {
  fromPane: PaneId;
  tabId: string;
}

export interface TextCount {
  chars: number;
  words: number;
}

export function panelTabLabel(panel: PanelTabKind, t: Translator): string {
  if (panel === "dashboard") return t("nav.dashboard");
  if (panel === "frontmatter") return t("nav.frontmatter");
  if (panel === "settings") return t("nav.settings");
  return t("nav.tools");
}

export function paneTabLabel(tab: Tab | null | undefined, t: Translator): string {
  if (!tab) return "";
  return tab.kind === "panel" ? panelTabLabel(tab.panel, t) : tab.name;
}

export function textCount(content: string): TextCount {
  return {
    chars: content.length,
    words: content.split(/\s+/).filter(Boolean).length
  };
}

export function markdownLinkForPaneTabPath(path: string): string {
  return `[[${path.replace(/\.md$/i, "")}]]`;
}

export function serializePaneTabDragPayload(payload: PaneTabDragPayload): string {
  return JSON.stringify(payload);
}

export function parsePaneTabDragPayload(raw: string): PaneTabDragPayload | null {
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as { fromPane?: PaneId; tabId?: string };
    return payload.fromPane && payload.tabId ? { fromPane: payload.fromPane, tabId: payload.tabId } : null;
  } catch {
    return null;
  }
}

export function readPaneTabDragPayload(dataTransfer: Pick<DataTransfer, "getData">): PaneTabDragPayload | null {
  return parsePaneTabDragPayload(dataTransfer.getData(PANE_TAB_DRAG_MIME));
}

export function dataTransferHasPaneTab(types: Iterable<string>): boolean {
  return Array.from(types).includes(PANE_TAB_DRAG_MIME);
}

export function paneTabDropPosition(
  clientX: number,
  rect: Pick<DOMRect, "left" | "width">
): "before" | "after" {
  return clientX < rect.left + rect.width / 2 ? "before" : "after";
}
