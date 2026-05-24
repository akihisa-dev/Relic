import type { FileTab, PaneId, PaneState, Tab } from "./store/editorStore";

export interface OutlineHeading {
  level: number;
  text: string;
}

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
  return content
    .split("\n")
    .flatMap((line) => {
      const match = /^(#{1,6}) (.+)/.exec(line);

      return match ? [{ level: match[1].length, text: match[2] }] : [];
    });
}
