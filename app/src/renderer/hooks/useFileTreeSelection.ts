import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";

import type { WorkspaceTreeNode } from "../../shared/ipc";

type SelectableTreeItem = {
  kind?: "image" | "markdown";
  path: string;
  type: WorkspaceTreeNode["type"];
};

interface UseFileTreeSelectionInput {
  nodes: WorkspaceTreeNode[];
  onSelectedCountChange?: (count: number) => void;
}

export function useFileTreeSelection({
  nodes,
  onSelectedCountChange
}: UseFileTreeSelectionInput): {
  handleSelectItem: (node: WorkspaceTreeNode, event: MouseEvent<HTMLButtonElement>) => boolean;
  selectedItems: SelectableTreeItem[];
  selectedPaths: Set<string>;
} {
  const [selectionAnchorPath, setSelectionAnchorPath] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const selectableItems = useMemo(() => collectSelectableItems(nodes), [nodes]);
  const selectablePathSet = useMemo(
    () => new Set(selectableItems.map((item) => item.path)),
    [selectableItems]
  );
  const effectiveSelectedPaths = useMemo(
    () => new Set([...selectedPaths].filter((path) => selectablePathSet.has(path))),
    [selectablePathSet, selectedPaths]
  );
  const effectiveSelectionAnchorPath =
    selectionAnchorPath && selectablePathSet.has(selectionAnchorPath) ? selectionAnchorPath : null;
  const selectedItems = useMemo(
    () => selectableItems.filter((item) => effectiveSelectedPaths.has(item.path)),
    [effectiveSelectedPaths, selectableItems]
  );

  useEffect(() => {
    onSelectedCountChange?.(selectedItems.length);
  }, [onSelectedCountChange, selectedItems.length]);

  const handleSelectItem = (
    node: WorkspaceTreeNode,
    event: MouseEvent<HTMLButtonElement>
  ): boolean => {
    if (!selectablePathSet.has(node.path)) return true;

    const isRangeSelect = event.shiftKey && effectiveSelectionAnchorPath;
    const isToggleSelect = event.metaKey || event.ctrlKey;
    const isMultiSelectionMode = effectiveSelectedPaths.size > 1;

    if (isRangeSelect) {
      const fromIndex = selectableItems.findIndex((item) => item.path === effectiveSelectionAnchorPath);
      const toIndex = selectableItems.findIndex((item) => item.path === node.path);
      if (fromIndex >= 0 && toIndex >= 0) {
        const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
        setSelectedPaths(new Set(selectableItems.slice(start, end + 1).map((item) => item.path)));
      }
      return false;
    }

    if (isToggleSelect) {
      setSelectedPaths((current) => {
        const next = new Set(current);
        if (next.has(node.path)) next.delete(node.path);
        else next.add(node.path);
        return next;
      });
      setSelectionAnchorPath(node.path);
      return false;
    }

    setSelectedPaths(new Set());
    setSelectionAnchorPath(null);
    return !isMultiSelectionMode;
  };

  return {
    handleSelectItem,
    selectedItems,
    selectedPaths: effectiveSelectedPaths
  };
}

function collectSelectableItems(nodes: WorkspaceTreeNode[]): SelectableTreeItem[] {
  const items: SelectableTreeItem[] = [];
  const walk = (node: WorkspaceTreeNode): void => {
    items.push({ kind: node.type === "file" ? node.kind : undefined, path: node.path, type: node.type });
    if (node.type === "folder") node.children.forEach(walk);
  };

  nodes.forEach(walk);
  return items;
}
