import type { FileTab, PaneId, PaneState, Tab } from "./store/editorStore";

export interface OutlineHeading {
  from: number;
  level: number;
  text: string;
}

export interface LineScrollTarget {
  lineNumber: number;
  type: "line";
}

export type HeadingScrollTarget = string | OutlineHeading | LineScrollTarget;

export const outlineHeadingsMaxCount = 1000;

export function getActiveTabInPane(
  pane: PaneId,
  panes: { leftPane: PaneState; rightPane: PaneState },
  tabs: Record<string, Tab>
): Tab | null {
  const paneState = pane === "left" ? panes.leftPane : panes.rightPane;

  return paneState.activeTabId ? tabs[paneState.activeTabId] ?? null : null;
}

export function getActiveFileTabInPane(
  pane: PaneId,
  panes: { leftPane: PaneState; rightPane: PaneState },
  tabs: Record<string, Tab>
): FileTab | null {
  const tab = getActiveTabInPane(pane, panes, tabs);

  return tab?.kind === "file" ? tab : null;
}

export function extractOutlineHeadings(content: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  let from = 0;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const match = /^(#{1,6}) (.+)/.exec(line);
    if (match) {
      const marker = match[1] ?? "";
      const text = match[2] ?? "";
      if (marker && text) {
        headings.push({ from, level: marker.length, text });
        if (headings.length >= outlineHeadingsMaxCount) break;
      }
    }
    from += rawLine.length + 1;
  }

  return headings;
}
