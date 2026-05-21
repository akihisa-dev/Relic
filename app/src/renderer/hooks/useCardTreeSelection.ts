import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";

import type { CardbookTreeNode } from "../../shared/ipc";

type SelectableTreeItem = {
  path: string;
  type: CardbookTreeNode["type"];
};

interface UseCardTreeSelectionInput {
  nodes: CardbookTreeNode[];
  onSelectedCountChange?: (count: number) => void;
}

export function useCardTreeSelection({
  nodes,
  onSelectedCountChange
}: UseCardTreeSelectionInput): {
  handleSelectItem: (node: CardbookTreeNode, event: MouseEvent<HTMLButtonElement>) => boolean;
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
  const selectedItems = useMemo(
    () => selectableItems.filter((item) => selectedPaths.has(item.path)),
    [selectableItems, selectedPaths]
  );

  useEffect(() => {
    setSelectedPaths((current) => {
      const next = new Set([...current].filter((path) => selectablePathSet.has(path)));
      return next.size === current.size ? current : next;
    });
    if (selectionAnchorPath && !selectablePathSet.has(selectionAnchorPath)) {
      setSelectionAnchorPath(null);
    }
  }, [selectablePathSet, selectionAnchorPath]);

  useEffect(() => {
    onSelectedCountChange?.(selectedItems.length);
  }, [onSelectedCountChange, selectedItems.length]);

  const handleSelectItem = (
    node: CardbookTreeNode,
    event: MouseEvent<HTMLButtonElement>
  ): boolean => {
    if (!selectablePathSet.has(node.path)) return true;

    const isRangeSelect = event.shiftKey && selectionAnchorPath && selectablePathSet.has(selectionAnchorPath);
    const isToggleSelect = event.metaKey || event.ctrlKey;
    const isMultiSelectionMode = selectedPaths.size > 1;

    if (isRangeSelect) {
      const fromIndex = selectableItems.findIndex((item) => item.path === selectionAnchorPath);
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

    setSelectedPaths(new Set([node.path]));
    setSelectionAnchorPath(node.path);
    return !isMultiSelectionMode;
  };

  return {
    handleSelectItem,
    selectedItems,
    selectedPaths
  };
}

function collectSelectableItems(nodes: CardbookTreeNode[]): SelectableTreeItem[] {
  const items: SelectableTreeItem[] = [];
  const walk = (node: CardbookTreeNode): void => {
    items.push({ path: node.path, type: node.type });
    if (node.type === "cardFolder") node.children.forEach(walk);
  };

  nodes.forEach(walk);
  return items;
}
