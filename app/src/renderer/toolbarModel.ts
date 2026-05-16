import type { HeadingLevel } from "./toolbarCommands";

export type ToolbarPanel = "heading" | "link" | "table";

export const TOOLBAR_HEADING_LEVELS: readonly HeadingLevel[] = [1, 2, 3, 4, 5, 6];

export function toolbarPanelClass(baseClassName: string, panel: ToolbarPanel, closingPanel: ToolbarPanel | null): string {
  return `${baseClassName}${closingPanel === panel ? " toolbar-panel--closing" : ""}`;
}

export function normalizeToolbarTableSize(rowsDraft: string, colsDraft: string): { cols: number; rows: number } {
  return {
    cols: Math.max(1, parseInt(colsDraft, 10) || 3),
    rows: Math.max(1, parseInt(rowsDraft, 10) || 3)
  };
}

export function buildToolbarTableMarkdown(
  rows: number,
  cols: number,
  columnLabel: (index: number) => string
): string {
  const header = "| " + Array.from({ length: cols }, (_, i) => columnLabel(i + 1)).join(" | ") + " |";
  const divider = "| " + Array.from({ length: cols }, () => "---").join(" | ") + " |";
  const row = "| " + Array.from({ length: cols }, () => "　").join(" | ") + " |";
  const bodyRows = Array.from({ length: rows }, () => row);

  return [header, divider, ...bodyRows].join("\n");
}
