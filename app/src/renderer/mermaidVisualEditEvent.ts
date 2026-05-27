export const mermaidVisualEditRequestEvent = "relic:mermaid-visual-edit-request";

export interface MermaidVisualEditRequest {
  blockFrom: number;
  blockTo: number;
  editCursor: number;
  source: string;
  sourceFrom: number;
  sourceTo: number;
}

export function dispatchMermaidVisualEditRequest(
  target: EventTarget,
  detail: MermaidVisualEditRequest
): void {
  target.dispatchEvent(new CustomEvent<MermaidVisualEditRequest>(mermaidVisualEditRequestEvent, {
    bubbles: true,
    detail
  }));
}
