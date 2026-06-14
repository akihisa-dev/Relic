import type { WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import type { RelicDiagramType } from "../../shared/diagramMarkdown";
import type { Translator } from "../i18nModel";
import type { Tab } from "../store/editorStore";
import { displayNameFromPath } from "../workspacePaths";

export type WorkspaceTreeItem = {
  path: string;
  type: WorkspaceTreeNode["type"];
};

export interface TabPathUpdate {
  name: string;
  path: string;
  tabId: string;
}

export function removeCoveredItems(items: WorkspaceTreeItem[]): WorkspaceTreeItem[] {
  return items.filter((item) => {
    return !items.some((other) => (
      other.type === "folder" &&
      other.path !== item.path &&
      item.path.startsWith(`${other.path}/`)
    ));
  });
}

export function nextUniqueFileName(workspaceState: WorkspaceState | null, t: Translator): string {
  const existing = new Set<string>();

  walkWorkspaceTree(workspaceState?.fileTree ?? [], (node) => {
    if (node.type === "file") existing.add(node.path);
  });

  for (let i = 1; ; i += 1) {
    const baseName = t("files.createNote");
    const name = i === 1 ? baseName : `${baseName} ${i}`;
    if (!existing.has(`${name}.md`)) return name;
  }
}

export function nextUniqueDiagramFileName(
  workspaceState: WorkspaceState | null,
  t: Translator,
  type: RelicDiagramType = "relationship",
  baseNameOverride?: string
): string {
  const existing = new Set<string>();

  walkWorkspaceTree(workspaceState?.fileTree ?? [], (node) => {
    if (node.type === "file") existing.add(node.path);
  });

  for (let i = 1; ; i += 1) {
    const baseName = baseNameOverride ?? (type === "why-tree"
      ? t("diagram.defaultNewWhyTreeName")
      : t("diagram.defaultNewRelationshipName"));
    const name = i === 1 ? baseName : `${baseName} ${i}`;
    if (!existing.has(`${name}.md`)) return name;
  }
}

export function nextUniqueFolderName(workspaceState: WorkspaceState | null, t: Translator): string {
  const existing = new Set<string>();

  walkWorkspaceTree(workspaceState?.fileTree ?? [], (node) => {
    if (node.type === "folder") existing.add(node.path);
  });

  for (let i = 1; ; i += 1) {
    const baseName = t("files.defaultNewFolderName");
    const name = i === 1 ? baseName : `${baseName} ${i}`;
    if (!existing.has(name)) return name;
  }
}

export function findCreatedMarkdownPath(fileTree: WorkspaceTreeNode[], expectedPath: string): string | null {
  let matchedPath: string | null = null;

  walkWorkspaceTree(fileTree, (node) => {
    if (matchedPath || node.type !== "file") return;
    if (node.path.endsWith(expectedPath)) matchedPath = node.path;
  });

  return matchedPath;
}

export function getMovableTreeItems(items: WorkspaceTreeItem[], destinationFolder: string): WorkspaceTreeItem[] {
  return removeCoveredItems(items).filter((item) => {
    if (item.path === destinationFolder) return false;
    if (item.type === "folder" && destinationFolder.startsWith(`${item.path}/`)) return false;
    return true;
  });
}

export function buildFolderTabPathUpdates(
  tabs: Record<string, Tab>,
  previousFolderPath: string,
  nextFolderPath: string
): TabPathUpdate[] {
  return Object.entries(tabs)
    .flatMap(([tabId, tab]) => {
      if (tab.kind !== "file" || !tab.path.startsWith(`${previousFolderPath}/`)) return [];

      const nextPath = `${nextFolderPath}/${tab.path.slice(previousFolderPath.length + 1)}`;
      return [{
        name: displayNameFromPath(nextPath),
        path: nextPath,
        tabId
      }];
    });
}

export function matchesTreeItemPath(tabPath: string, item: WorkspaceTreeItem): boolean {
  return item.type === "file" ? tabPath === item.path : tabPath.startsWith(`${item.path}/`);
}

export function matchesAnyTreeItemPath(tabPath: string, items: WorkspaceTreeItem[]): boolean {
  return items.some((item) => matchesTreeItemPath(tabPath, item));
}

function walkWorkspaceTree(nodes: WorkspaceTreeNode[], visit: (node: WorkspaceTreeNode) => void): void {
  for (const node of nodes) {
    visit(node);
    if (node.type === "folder") walkWorkspaceTree(node.children, visit);
  }
}
