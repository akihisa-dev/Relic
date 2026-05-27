export const mermaidVisualEditRequestEvent = "relic:mermaid-visual-edit-request";

export interface MermaidVisualEditRequest {
  blockIndex: number;
  blockFrom: number;
  blockTo: number;
  editCursor: number;
  source: string;
  sourceHash: string;
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
