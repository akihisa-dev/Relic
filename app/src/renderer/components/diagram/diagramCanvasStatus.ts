import { parseRelicDiagramMarkdown } from "../../../shared/diagramMarkdown";
import type { useT } from "../../i18n";
import { countWhyTreeItems } from "./whyTreeStats";

export function diagramCanvasStatus(content: string, t: ReturnType<typeof useT>): string {
  const parsed = parseRelicDiagramMarkdown(content);
  if (!parsed.ok) return t("diagram.invalidStatus");

  if (parsed.value.type === "why-tree") {
    const counts = countWhyTreeItems(parsed.value);
    return t("diagram.whyTreeStatus", {
      actions: counts.actions,
      facts: counts.facts,
      solutions: counts.solutions,
      whys: counts.whys
    });
  }

  return t("diagram.status", {
    lines: parsed.value.lines.length,
    nodes: parsed.value.nodes.length
  });
}
