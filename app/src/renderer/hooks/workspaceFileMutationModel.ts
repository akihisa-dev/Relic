import type { WorkspaceTreeNode } from "../../shared/ipc";
import type { Translator } from "../i18n";
import type { FileTab, PaneId, PaneState, Tab } from "../store/editorStore";
import { displayNameFromPath, joinWorkspacePath, parentFolderOf } from "../workspacePaths";
import { matchesAnyTreeItemPath, matchesTreeItemPath } from "./workspaceFileActionHelpers";

export interface ActiveFileTab {
  tab: FileTab;
  tabId: string;
}

export interface TabCloseTarget {
  pane: PaneId;
  tabId: string;
}

export function getActiveFileTab({
  focusedPane,
  leftPane,
  rightPane,
  tabs
}: {
  focusedPane: PaneId;
  leftPane: PaneState;
  rightPane: PaneState;
  tabs: Record<string, Tab>;
}): ActiveFileTab | null {
  const paneState = focusedPane === "left" ? leftPane : rightPane;
  const tabId = paneState.activeTabId;

  if (!tabId) return null;

  const tab = tabs[tabId];
  if (!tab || tab.kind !== "file") return null;

  return { tab, tabId };
}

export function movedFolderPath(path: string, destFolder: string): string {
  return joinWorkspacePath(destFolder, displayNameFromPath(path));
}

export function movedFilePath(path: string, destFolder: string): string {
  return joinWorkspacePath(destFolder, displayNameFromPath(path));
}

export function renamedFolderPath(path: string, newName: string): string {
  return joinWorkspacePath(parentFolderOf(path), newName);
}

export function renamedFilePath(path: string, newName: string): string {
  return joinWorkspacePath(parentFolderOf(path), newName.endsWith(".md") ? newName : `${newName}.md`);
}

export function deleteTreeItemMessage(path: string, type: WorkspaceTreeNode["type"], t: Translator): string {
  const name = displayNameFromPath(path);
  return type === "folder" ? t("files.deleteFolderConfirm", { name }) : t("files.deleteFileConfirm", { name });
}

export function deleteTreeItemsMessage(itemCount: number, t: Translator): string {
  return t("files.deleteItemsConfirm", { count: itemCount });
}

export function tabCloseTargetsForTreeItem({
  item,
  leftPane,
  rightPane,
  tabs
}: {
  item: { path: string; type: WorkspaceTreeNode["type"] };
  leftPane: PaneState;
  rightPane: PaneState;
  tabs: Record<string, Tab>;
}): TabCloseTarget[] {
  const targets: TabCloseTarget[] = [];

  for (const tabId of leftPane.tabIds) {
    const tab = tabs[tabId];
    if (tab?.kind === "file" && matchesTreeItemPath(tab.path, item)) targets.push({ pane: "left", tabId });
  }

  for (const tabId of rightPane.tabIds) {
    const tab = tabs[tabId];
    if (tab?.kind === "file" && matchesTreeItemPath(tab.path, item)) targets.push({ pane: "right", tabId });
  }

  return targets;
}

export function tabCloseTargetsForTreeItems({
  items,
  leftPane,
  rightPane,
  tabs
}: {
  items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>;
  leftPane: PaneState;
  rightPane: PaneState;
  tabs: Record<string, Tab>;
}): TabCloseTarget[] {
  const targets: TabCloseTarget[] = [];

  for (const tabId of leftPane.tabIds) {
    const tab = tabs[tabId];
    if (tab?.kind === "file" && matchesAnyTreeItemPath(tab.path, items)) targets.push({ pane: "left", tabId });
  }

  for (const tabId of rightPane.tabIds) {
    const tab = tabs[tabId];
    if (tab?.kind === "file" && matchesAnyTreeItemPath(tab.path, items)) targets.push({ pane: "right", tabId });
  }

  return targets;
}
