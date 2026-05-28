import type { DiagramLanguage } from "./diagramLanguage";
import type { DiagramRenderHandle } from "./diagramPanZoom";

export type DiagramRenderState =
  | { language: DiagramLanguage; source: string; status: "rendering"; token: number }
  | { handle: DiagramRenderHandle; language: DiagramLanguage; source: string; status: "rendered"; token: number }
  | { error: unknown; language: DiagramLanguage; source: string; status: "error"; token: number }
  | { language: DiagramLanguage; reason: "detached" | "superseded"; source: string; status: "stale"; token: number };

export type DiagramRenderContext = {
  canApplyResult: () => boolean;
  markError: (error: unknown) => void;
  markRendered: (handle: DiagramRenderHandle) => void;
};

let renderTokenId = 0;
const activeRenderStates = new WeakMap<HTMLElement, DiagramRenderState>();

export function beginDiagramRender(
  container: HTMLElement,
  language: DiagramLanguage,
  source: string
): DiagramRenderContext {
  const token = ++renderTokenId;
  setDiagramRenderState(container, { language, source, status: "rendering", token });

  const isCurrentRender = () => activeRenderStates.get(container)?.token === token;

  const markStaleIfCurrent = (reason: "detached" | "superseded") => {
    if (!isCurrentRender()) return;
    setDiagramRenderState(container, { language, reason, source, status: "stale", token });
  };

  return {
    canApplyResult: () => {
      const current = activeRenderStates.get(container);

      if (current?.token !== token || current.status !== "rendering") {
        markStaleIfCurrent("superseded");
        return false;
      }

      if (!container.isConnected) {
        markStaleIfCurrent("detached");
        return false;
      }

      return true;
    },
    markError: (error) => {
      if (!isCurrentRender()) return;
      setDiagramRenderState(container, { error, language, source, status: "error", token });
    },
    markRendered: (handle) => {
      if (!isCurrentRender()) return;
      setDiagramRenderState(container, { handle, language, source, status: "rendered", token });
    }
  };
}

function setDiagramRenderState(container: HTMLElement, state: DiagramRenderState): void {
  activeRenderStates.set(container, state);
  container.dataset.diagramRenderStatus = state.status;
}
