import type { RelicWhyTreeDocument, RelicWhyTreeNode } from "../../../shared/diagramMarkdown";

export interface WhyTreeItemCounts {
  actions: number;
  facts: number;
  solutions: number;
  whys: number;
}

export function countWhyTreeItems(tree: RelicWhyTreeDocument): WhyTreeItemCounts {
  const counts: WhyTreeItemCounts = { actions: 0, facts: 0, solutions: 0, whys: 0 };
  countWhyTreeNode(tree.phenomenon, counts, false);
  return counts;
}

function countWhyTreeNode(node: RelicWhyTreeNode, counts: WhyTreeItemCounts, isWhy: boolean): void {
  counts.actions += node.actions.length;
  counts.facts += node.facts.length;
  counts.solutions += node.solutions.length;
  if (isWhy) counts.whys += 1;

  node.whys.forEach((why) => countWhyTreeNode(why, counts, true));
}
