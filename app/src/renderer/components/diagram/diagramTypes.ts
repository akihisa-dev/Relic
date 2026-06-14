import { type ReactElement } from "react";

export interface DiagramCanvasProps {
  content: string;
  fileName: string;
  onChange?: (content: string) => void;
  toolbar?: ReactElement;
}
