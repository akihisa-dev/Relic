import type { CardbookState, CardbookTreeNode } from "../../shared/ipc";
import type { Translator } from "../i18n";
import type { Tab } from "../store/editorStore";
import { displayNameFromPath } from "../cardbookPaths";

export type CardbookTreeItem = {
  path: string;
  type: CardbookTreeNode["type"];
};

export interface TabPathUpdate {
  name: string;
  path: string;
  tabId: string;
}

export function removeCoveredItems(items: CardbookTreeItem[]): CardbookTreeItem[] {
  return items.filter((item) => {
    return !items.some((other) => (
      other.type === "cardFolder" &&
      other.path !== item.path &&
      item.path.startsWith(`${other.path}/`)
    ));
  });
}

export function nextUniqueCardName(cardbookState: CardbookState | null, t: Translator): string {
  const existing = new Set<string>();

  walkCardbookTree(cardbookState?.cardTree ?? [], (node) => {
    if (node.type === "card") existing.add(node.path);
  });

  for (let i = 1; ; i += 1) {
    const baseName = t("cards.createNote");
    const name = i === 1 ? baseName : `${baseName} ${i}`;
    if (!existing.has(`${name}.md`)) return name;
  }
}

export function nextUniqueCardFolderName(cardbookState: CardbookState | null, t: Translator): string {
  const existing = new Set<string>();

  walkCardbookTree(cardbookState?.cardTree ?? [], (node) => {
    if (node.type === "cardFolder") existing.add(node.path);
  });

  for (let i = 1; ; i += 1) {
    const baseName = t("cards.defaultNewCardFolderName");
    const name = i === 1 ? baseName : `${baseName} ${i}`;
    if (!existing.has(name)) return name;
  }
}

export function findCreatedMarkdownPath(cardTree: CardbookTreeNode[], expectedPath: string): string | null {
  let matchedPath: string | null = null;

  walkCardbookTree(cardTree, (node) => {
    if (matchedPath || node.type !== "card") return;
    if (node.path.endsWith(expectedPath)) matchedPath = node.path;
  });

  return matchedPath;
}

export function getMovableTreeItems(items: CardbookTreeItem[], destinationCardFolder: string): CardbookTreeItem[] {
  return removeCoveredItems(items).filter((item) => {
    if (item.path === destinationCardFolder) return false;
    if (item.type === "cardFolder" && destinationCardFolder.startsWith(`${item.path}/`)) return false;
    return true;
  });
}

export function buildCardFolderTabPathUpdates(
  tabs: Record<string, Tab>,
  previousCardFolderPath: string,
  nextCardFolderPath: string
): TabPathUpdate[] {
  return Object.entries(tabs)
    .flatMap(([tabId, tab]) => {
      if (tab.kind !== "card" || !tab.path.startsWith(`${previousCardFolderPath}/`)) return [];

      const nextPath = `${nextCardFolderPath}/${tab.path.slice(previousCardFolderPath.length + 1)}`;
      return [{
        name: displayNameFromPath(nextPath),
        path: nextPath,
        tabId
      }];
    });
}

export function matchesTreeItemPath(tabPath: string, item: CardbookTreeItem): boolean {
  return item.type === "card" ? tabPath === item.path : tabPath.startsWith(`${item.path}/`);
}

export function matchesAnyTreeItemPath(tabPath: string, items: CardbookTreeItem[]): boolean {
  return items.some((item) => matchesTreeItemPath(tabPath, item));
}

function walkCardbookTree(nodes: CardbookTreeNode[], visit: (node: CardbookTreeNode) => void): void {
  for (const node of nodes) {
    visit(node);
    if (node.type === "cardFolder") walkCardbookTree(node.children, visit);
  }
}
