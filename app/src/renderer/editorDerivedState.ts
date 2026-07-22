import type { FileTab, PaneId, PaneState, Tab } from "./store/editorStore";
import { textChangeRange } from "./textChangeRange";

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

export interface OutlineSnapshot {
  content: string;
  headings: OutlineHeading[];
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
  return extractOutlineHeadingsFromRange(content, 0);
}

export function updateOutlineSnapshot(previous: OutlineSnapshot | null, content: string): OutlineSnapshot {
  if (!previous) return { content, headings: extractOutlineHeadings(content) };
  if (previous.content === content) return previous;
  if (previous.headings.length >= outlineHeadingsMaxCount) {
    return { content, headings: extractOutlineHeadings(content) };
  }

  const change = textChangeRange(previous.content, content);
  if (!change) return previous;

  const from = lineStart(previous.content, change.from);
  const oldTo = lineEnd(previous.content, change.oldTo);
  const newTo = lineEnd(content, change.newTo);
  const delta = newTo - oldTo;
  const before = previous.headings.filter((heading) => heading.from < from);
  const changed = extractOutlineHeadingsFromRange(content.slice(from, newTo), from);
  const after = previous.headings
    .filter((heading) => heading.from >= oldTo)
    .map((heading) => ({ ...heading, from: heading.from + delta }));

  const headings = [...before, ...changed, ...after];
  return {
    content,
    headings: headings.length > outlineHeadingsMaxCount
      ? extractOutlineHeadings(content)
      : headings
  };
}

function extractOutlineHeadingsFromRange(content: string, offset: number): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  let from = offset;

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

function lineStart(content: string, position: number): number {
  return content.lastIndexOf("\n", Math.max(0, position - 1)) + 1;
}

function lineEnd(content: string, position: number): number {
  const newline = content.indexOf("\n", position);
  return newline < 0 ? content.length : newline + 1;
}
