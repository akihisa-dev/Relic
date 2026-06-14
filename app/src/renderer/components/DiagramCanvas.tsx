import { type ReactElement } from "react";

import { parseRelicDiagramMarkdown } from "../../shared/diagramMarkdown";
import { useT } from "../i18n";
import { DiagramCanvasRouter } from "./diagram/DiagramCanvasRouter";
import { type DiagramCanvasProps } from "./diagram/diagramTypes";
import { countWhyTreeItems } from "./diagram/WhyTreeEditor";

export function DiagramCanvas({ content, fileName, onChange }: DiagramCanvasProps): ReactElement {
  return <DiagramCanvasRouter content={content} fileName={fileName} onChange={onChange} />;
}

export function diagramCanvasStatus(content: string, t: ReturnType<typeof useT>): string {
  const parsed = parseRelicDiagramMarkdown(content);
  if (!parsed.ok) return t("diagram.invalidStatus");

  if (parsed.value.type === "why-tree") {
    const counts = countWhyTreeItems(parsed.value);
    return t("diagram.whyTreeStatus", counts);
  }

  return t("diagram.status", {
    lines: parsed.value.lines.length,
    nodes: parsed.value.nodes.length
  });
}
