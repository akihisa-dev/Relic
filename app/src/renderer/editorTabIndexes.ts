import type { FileTab, Tab } from "./store/editorStoreTypes";

export interface EditorTabIndex {
  dirtyMarkdownPaths: string[];
  hasOpenChart: boolean;
  openFilePathSet: Set<string>;
  presentationByTabId: ReadonlyMap<string, string>;
}

const indexes = new WeakMap<Record<string, Tab>, EditorTabIndex>();
let indexBuildCount = 0;

export function editorTabIndex(tabs: Record<string, Tab>): EditorTabIndex {
  const cached = indexes.get(tabs);
  if (cached) return cached;
  indexBuildCount += 1;

  const dirtyMarkdownPaths: string[] = [];
  const openFilePathSet = new Set<string>();
  const presentationByTabId = new Map<string, string>();
  let hasOpenChart = false;

  for (const tab of Object.values(tabs)) {
    if (tab.kind === "file") {
      openFilePathSet.add(tab.path);
      if (isDirtyFileTab(tab)) dirtyMarkdownPaths.push(tab.path);
    }
    if (tab.kind === "chart") hasOpenChart = true;
    presentationByTabId.set(tab.id, tabPresentationToken(tab));
  }

  const index = { dirtyMarkdownPaths, hasOpenChart, openFilePathSet, presentationByTabId };
  indexes.set(tabs, index);
  return index;
}

export function transferEditorTabContentIndex(
  previousTabs: Record<string, Tab>,
  nextTabs: Record<string, Tab>,
  previousTab: FileTab,
  nextTab: FileTab
): void {
  const previous = editorTabIndex(previousTabs);
  const previousDirty = isDirtyFileTab(previousTab);
  const nextDirty = isDirtyFileTab(nextTab);
  const dirtyMarkdownPaths = previousDirty === nextDirty
    ? previous.dirtyMarkdownPaths
    : nextDirty
      ? [...previous.dirtyMarkdownPaths, nextTab.path]
      : previous.dirtyMarkdownPaths.filter((path) => path !== previousTab.path);

  indexes.set(nextTabs, { ...previous, dirtyMarkdownPaths });
}

function isDirtyFileTab(tab: FileTab): boolean {
  return tab.content !== tab.savedContent || Boolean(tab.externalConflict);
}

function tabPresentationToken(tab: Tab): string {
  const target = tab.kind === "file" || tab.kind === "image" || tab.kind === "pdf"
    ? tab.path
    : tab.kind === "chart"
      ? tab.chartId
      : tab.panel;
  return `${tab.id}\u0000${tab.kind}\u0000${tab.name}\u0000${target}\u0000${tab.isPinned ? "1" : "0"}`;
}

/** @internal Test-only counter for deterministic tab-index assertions. */
export function __getEditorTabIndexBuildCountForTests(): number {
  return indexBuildCount;
}

/** @internal Test-only reset for deterministic tab-index assertions. */
export function __resetEditorTabIndexBuildCountForTests(): void {
  indexBuildCount = 0;
}
