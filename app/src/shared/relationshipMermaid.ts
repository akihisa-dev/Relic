import { type RelicRelationshipDiagramDocument } from "./diagramMarkdown";
import { markdownFileDisplayName, mermaidQuoted, mermaidSafeId } from "./mermaidText";

export function relationshipToMermaid(diagram: RelicRelationshipDiagramDocument): string {
  const usedIds = new Set<string>();
  const nodeIdByRelicId = new Map<string, string>();
  const lines = ["flowchart TD"];

  diagram.nodes.forEach((node, index) => {
    const mermaidId = mermaidSafeId(node.id, `node_${index + 1}`, usedIds);
    nodeIdByRelicId.set(node.id, mermaidId);
    lines.push(`  ${mermaidId}[${mermaidQuoted(markdownFileDisplayName(node.file))}]`);
  });

  diagram.lines.forEach((line) => {
    const from = nodeIdByRelicId.get(line.from);
    const to = nodeIdByRelicId.get(line.to);
    if (!from || !to) return;

    lines.push(line.label.trim().length > 0
      ? `  ${from} -->|${mermaidQuoted(line.label)}| ${to}`
      : `  ${from} --> ${to}`);
  });

  return `${lines.join("\n")}\n`;
}
