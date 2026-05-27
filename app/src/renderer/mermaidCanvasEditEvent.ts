export const mermaidCanvasEditRequestEvent = "relic:mermaid-canvas-edit-request";

export interface MermaidCanvasEditRequest {
  blockFrom: number;
  blockTo: number;
  editCursor: number;
  source: string;
  sourceFrom: number;
  sourceTo: number;
}

export function dispatchMermaidCanvasEditRequest(
  target: EventTarget,
  detail: MermaidCanvasEditRequest
): void {
  target.dispatchEvent(new CustomEvent<MermaidCanvasEditRequest>(mermaidCanvasEditRequestEvent, {
    bubbles: true,
    detail
  }));
}
