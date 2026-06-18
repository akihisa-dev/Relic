import { type ReactElement } from "react";

import { DiagramCanvasRouter } from "./diagram/DiagramCanvasRouter";
import { type DiagramCanvasProps } from "./diagram/diagramTypes";

export function DiagramCanvas({ content, fileName, onChange, onSourceModeToggle }: DiagramCanvasProps): ReactElement {
  return (
    <DiagramCanvasRouter
      content={content}
      fileName={fileName}
      onChange={onChange}
      onSourceModeToggle={onSourceModeToggle}
    />
  );
}
