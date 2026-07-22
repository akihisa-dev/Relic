import type { TranslationKey, Translator } from "./i18nModel";
import type { PaneId, PanelTabKind, Tab } from "./store/editorStore";
import { textChangeRange } from "./textChangeRange";

export const PANE_TAB_DRAG_MIME = "application/relic-tab";

export interface PaneTabDragPayload {
  fromPane: PaneId;
  tabId: string;
}

export interface TextCount {
  chars: number;
  words: number;
}

export interface TextCountSnapshot extends TextCount {
  content: string;
}

const CHART_TAB_LABEL_KEYS: Readonly<Record<string, TranslationKey>> = {
  cards: "nav.cards",
  chronicle: "nav.chronicle",
  graph: "nav.graph",
  sphere: "nav.sphere",
  table: "nav.table"
};

export function panelTabLabel(panel: PanelTabKind, t: Translator): string {
  if (panel === "frontmatter") return t("nav.frontmatter");
  return t("nav.settings");
}

export function paneTabLabel(tab: Tab | null | undefined, t: Translator): string {
  if (!tab) return "";
  if (tab.kind === "panel") return panelTabLabel(tab.panel, t);
  if (tab.kind === "chart") {
    const labelKey = CHART_TAB_LABEL_KEYS[tab.chartId];
    return labelKey ? t(labelKey) : tab.name;
  }
  return tab.name;
}

export function textCount(content: string): TextCount {
  return {
    chars: content.length,
    words: content.split(/\s+/).filter(Boolean).length
  };
}

export function updateTextCount(previous: TextCountSnapshot | null, content: string): TextCountSnapshot {
  if (!previous) return { content, ...textCount(content) };
  if (previous.content === content) return previous;

  const range = textChangeRange(previous.content, content);
  if (!range) return previous;

  let from = range.from;
  while (from > 0 && !/\s/.test(content[from - 1] ?? "")) from -= 1;

  let oldTo = range.oldTo;
  while (oldTo < previous.content.length && !/\s/.test(previous.content[oldTo] ?? "")) oldTo += 1;

  let newTo = range.newTo;
  while (newTo < content.length && !/\s/.test(content[newTo] ?? "")) newTo += 1;

  return {
    chars: content.length,
    content,
    words: previous.words - countWords(previous.content.slice(from, oldTo)) + countWords(content.slice(from, newTo))
  };
}

function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
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
