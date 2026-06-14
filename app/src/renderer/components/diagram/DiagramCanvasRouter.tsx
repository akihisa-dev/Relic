import { type ReactElement, useMemo } from "react";

import { parseRelicDiagramMarkdown } from "../../../shared/diagramMarkdown";
import { relationshipToMermaid } from "../../../shared/relationshipMermaid";
import { whyTreeToMermaid } from "../../../shared/whyTreeMermaid";
import { useT } from "../../i18n";
import { DiagramToolbar } from "./DiagramToolbar";
import { RelationshipCanvas } from "./RelationshipCanvas";
import { type DiagramCanvasProps } from "./diagramTypes";
import { WhyTreeEditor } from "./WhyTreeEditor";

export function DiagramCanvasRouter({ content, fileName, onChange }: DiagramCanvasProps): ReactElement {
  const t = useT();
  const parsed = useMemo(() => parseRelicDiagramMarkdown(content), [content]);

  if (!parsed.ok) {
    return (
      <div className="diagram-canvas diagram-canvas--invalid" role="alert">
        <p>{t("diagram.invalidFile")}</p>
      </div>
    );
  }

  if (parsed.value.type === "why-tree") {
    return (
      <WhyTreeEditor
        content={content}
        fileName={fileName}
        onChange={onChange}
        toolbar={<DiagramToolbar mermaidSource={whyTreeToMermaid(parsed.value)} />}
        tree={parsed.value}
      />
    );
  }

  return (
    <RelationshipCanvas
      content={content}
      diagram={parsed.value}
      fileName={fileName}
      onChange={onChange}
      toolbar={<DiagramToolbar mermaidSource={relationshipToMermaid(parsed.value)} />}
    />
  );
}
