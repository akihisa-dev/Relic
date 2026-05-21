import type { CardbookTreeNode } from "../../shared/ipc";
import type { Translator } from "../i18n";
import type { CardTab, PaneId, PaneState, Tab } from "../store/editorStore";
import { displayNameFromPath, joinCardbookPath, parentCardFolderOf } from "../cardbookPaths";
import { matchesAnyTreeItemPath, matchesTreeItemPath } from "./cardbookCardActionHelpers";

export interface ActiveCardTab {
  tab: CardTab;
  tabId: string;
}

export interface TabCloseTarget {
  pane: PaneId;
  tabId: string;
}

export function getActiveCardTab({
  focusedPane,
  leftPane,
  rightPane,
  tabs
}: {
  focusedPane: PaneId;
  leftPane: PaneState;
  rightPane: PaneState;
  tabs: Record<string, Tab>;
}): ActiveCardTab | null {
  const paneState = focusedPane === "left" ? leftPane : rightPane;
  const tabId = paneState.activeTabId;

  if (!tabId) return null;

  const tab = tabs[tabId];
  if (!tab || tab.kind !== "card") return null;

  return { tab, tabId };
}

export function movedCardFolderPath(path: string, destCardFolder: string): string {
  return joinCardbookPath(destCardFolder, displayNameFromPath(path));
}

export function renamedCardFolderPath(path: string, newName: string): string {
  return joinCardbookPath(parentCardFolderOf(path), newName);
}

export function deleteTreeItemMessage(path: string, type: CardbookTreeNode["type"], t: Translator): string {
  const name = displayNameFromPath(path);
  return type === "cardFolder" ? t("cards.deleteCardFolderConfirm", { name }) : t("cards.deleteCardConfirm", { name });
}

export function deleteTreeItemsMessage(itemCount: number, t: Translator): string {
  return t("cards.deleteItemsConfirm", { count: itemCount });
}

export function tabCloseTargetsForTreeItem({
  item,
  leftPane,
  rightPane,
  tabs
}: {
  item: { path: string; type: CardbookTreeNode["type"] };
  leftPane: PaneState;
  rightPane: PaneState;
  tabs: Record<string, Tab>;
}): TabCloseTarget[] {
  const targets: TabCloseTarget[] = [];

  for (const tabId of leftPane.tabIds) {
    const tab = tabs[tabId];
    if (tab?.kind === "card" && matchesTreeItemPath(tab.path, item)) targets.push({ pane: "left", tabId });
  }

  for (const tabId of rightPane.tabIds) {
    const tab = tabs[tabId];
    if (tab?.kind === "card" && matchesTreeItemPath(tab.path, item)) targets.push({ pane: "right", tabId });
  }

  return targets;
}

export function tabCloseTargetsForTreeItems({
  items,
  leftPane,
  rightPane,
  tabs
}: {
  items: Array<{ path: string; type: CardbookTreeNode["type"] }>;
  leftPane: PaneState;
  rightPane: PaneState;
  tabs: Record<string, Tab>;
}): TabCloseTarget[] {
  const targets: TabCloseTarget[] = [];

  for (const tabId of leftPane.tabIds) {
    const tab = tabs[tabId];
    if (tab?.kind === "card" && matchesAnyTreeItemPath(tab.path, items)) targets.push({ pane: "left", tabId });
  }

  for (const tabId of rightPane.tabIds) {
    const tab = tabs[tabId];
    if (tab?.kind === "card" && matchesAnyTreeItemPath(tab.path, items)) targets.push({ pane: "right", tabId });
  }

  return targets;
}
