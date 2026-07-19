import type { ToolTarget, WorkspaceTreeNode } from "../shared/ipc";
import { workspaceFileKindForPath } from "../shared/workspaceFileKinds";
import {
  canMoveAllFileTreeItems,
  fileTreeOperationItems,
  type FileTreeMoveItem
} from "./fileTreeModel";

export interface FileTreeContextTarget {
  canMove: boolean;
  hasMixedSelection: boolean;
  isMarkdownFile: boolean;
  operationItems: FileTreeMoveItem[];
  toolTarget: ToolTarget | null;
}

export function deriveFileTreeContextTarget(
  node: WorkspaceTreeNode,
  selectedItems: FileTreeMoveItem[],
  useSelectedItems: boolean
): FileTreeContextTarget {
  const fileKind = node.type === "file" ? node.kind ?? workspaceFileKindForPath(node.path) : null;
  const operationItems = fileTreeOperationItems(node, selectedItems, useSelectedItems);
  const selectedMarkdownPaths = selectedItems
    .filter((item) => item.type === "file" && (item.kind === "markdown" || item.kind === undefined && /\.md$/i.test(item.path)))
    .map((item) => item.path);
  const hasMixedSelection = useSelectedItems && selectedMarkdownPaths.length !== selectedItems.length;

  return {
    canMove: canMoveAllFileTreeItems(operationItems),
    hasMixedSelection,
    isMarkdownFile: node.type === "file" && fileKind === "markdown",
    operationItems,
    toolTarget: useSelectedItems
      ? hasMixedSelection ? null : { kind: "files", paths: selectedMarkdownPaths }
      : node.type === "folder" ? { kind: "folder", path: node.path } : null
  };
}
