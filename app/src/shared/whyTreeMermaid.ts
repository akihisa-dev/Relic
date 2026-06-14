import { type RelicWhyTreeDocument, type RelicWhyTreeNode } from "./diagramMarkdown";
import { mermaidQuoted, mermaidSafeId } from "./mermaidText";

type SupplementKind = "fact" | "solution" | "action";

interface BuildContext {
  lines: string[];
  usedIds: Set<string>;
}

export function whyTreeToMermaid(tree: RelicWhyTreeDocument): string {
  const context: BuildContext = {
    lines: ["flowchart TD"],
    usedIds: new Set<string>()
  };
  const phenomenonId = mermaidSafeId("phenomenon", "phenomenon", context.usedIds);

  context.lines.push(`  ${phenomenonId}[${mermaidQuoted(tree.phenomenon.title)}]`);
  appendSupplements(context, phenomenonId, tree.phenomenon, "phenomenon");
  appendWhyNodes(context, phenomenonId, tree.phenomenon.whys, "why");

  return `${context.lines.join("\n")}\n`;
}

function appendWhyNodes(context: BuildContext, parentId: string, whys: RelicWhyTreeNode[], pathPrefix: string): void {
  whys.forEach((why, index) => {
    const path = `${pathPrefix}_${index + 1}`;
    const whyId = mermaidSafeId(path, path, context.usedIds);
    context.lines.push(`  ${whyId}[${mermaidQuoted(why.title)}]`);
    context.lines.push(`  ${parentId} --> ${whyId}`);
    appendSupplements(context, whyId, why, path);
    appendWhyNodes(context, whyId, why.whys, path);
  });
}

function appendSupplements(context: BuildContext, parentId: string, node: RelicWhyTreeNode, pathPrefix: string): void {
  appendSupplementList(context, parentId, node.facts, "fact", pathPrefix);
  appendSupplementList(context, parentId, node.solutions, "solution", pathPrefix);
  appendSupplementList(context, parentId, node.actions, "action", pathPrefix);
}

function appendSupplementList(
  context: BuildContext,
  parentId: string,
  values: string[],
  kind: SupplementKind,
  pathPrefix: string
): void {
  values.forEach((value, index) => {
    const itemId = mermaidSafeId(`${pathPrefix}_${kind}_${index + 1}`, `${kind}_${index + 1}`, context.usedIds);
    context.lines.push(`  ${itemId}[${mermaidQuoted(`${supplementLabel(kind)}: ${value}`)}]`);
    context.lines.push(`  ${parentId} --> ${itemId}`);
  });
}

function supplementLabel(kind: SupplementKind): "Fact" | "Solution" | "Action" {
  if (kind === "fact") return "Fact";
  if (kind === "solution") return "Solution";
  return "Action";
}
