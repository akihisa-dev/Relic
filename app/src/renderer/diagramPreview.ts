import DOMPurify from "dompurify";

import { enqueueD2Render } from "./d2Renderer";
import { buildDiagramError } from "./diagramErrorView";
import { diagramLabel, diagramLanguageFor, type DiagramLanguage } from "./diagramLanguage";
import { initializeDiagramPanZoom, type DiagramRenderHandle } from "./diagramPanZoom";
import { decodeDiagramSourceAttribute } from "./diagramSourceAttribute";
import { renderMermaidSvg } from "./mermaidRenderer";

export { diagramLanguageFor, type DiagramLanguage } from "./diagramLanguage";
export { buildDiagramError } from "./diagramErrorView";
export type { DiagramRenderHandle } from "./diagramPanZoom";

let renderTokenId = 0;
const activeRenderStates = new WeakMap<HTMLElement, DiagramRenderState>();

type DiagramRenderState =
  | { language: DiagramLanguage; source: string; status: "rendering"; token: number }
  | { handle: DiagramRenderHandle; language: DiagramLanguage; source: string; status: "rendered"; token: number }
  | { error: unknown; language: DiagramLanguage; source: string; status: "error"; token: number }
  | { language: DiagramLanguage; reason: "detached" | "superseded"; source: string; status: "stale"; token: number };

type DiagramRenderContext = {
  canApplyResult: () => boolean;
  markError: (error: unknown) => void;
  markRendered: (handle: DiagramRenderHandle) => void;
};

export function buildDiagramFallback(language: DiagramLanguage, source: string): HTMLElement {
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = `language-${language}`;
  code.textContent = source;
  pre.append(code);
  return pre;
}

export async function renderDiagramElement(
  container: HTMLElement,
  language: DiagramLanguage,
  source: string
): Promise<DiagramRenderHandle | null> {
  const renderContext = beginDiagramRender(container, language, source);

  try {
    const svg = await renderDiagramSvg(language, source);
    if (!renderContext.canApplyResult()) return null;

    const sanitized = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
    if (!renderContext.canApplyResult()) return null;

    container.replaceChildren();
    const diagram = document.createElement("div");
    diagram.className = `preview-diagram-svg preview-diagram-svg--${language}`;
    diagram.innerHTML = sanitized;
    applyDiagramSvgIntrinsicSize(diagram);

    const viewport = document.createElement("div");
    viewport.className = "preview-diagram-panzoom-viewport";
    viewport.tabIndex = 0;
    viewport.setAttribute(
      "aria-label",
      `${diagramLabel(language)}図。+で拡大、-で縮小、0またはfで全体表示、矢印キーで移動、Shift+矢印キーで大きく移動できます。`
    );
    const content = document.createElement("div");
    content.className = "preview-diagram-panzoom-content";
    content.append(diagram);
    viewport.append(content);
    const handle = initializeDiagramPanZoom(viewport, content);
    container.append(viewport);
    renderContext.markRendered(handle);
    return handle;
  } catch (error) {
    if (!renderContext.canApplyResult()) return null;

    console.warn(`${diagramLabel(language)} diagram rendering failed.`, error);
    container.replaceChildren(buildDiagramError(language, source, error));
    renderContext.markError(error);
    return null;
  }
}

export function renderDiagramElements(root: ParentNode): void {
  const diagrams = root.querySelectorAll<HTMLElement>(".preview-diagram");

  diagrams.forEach((diagram) => {
    const language = diagramLanguageFor(diagram.dataset.diagramLanguage);
    if (!language) return;

    const source = diagram.dataset.diagramSource === undefined
      ? ""
      : decodeDiagramSourceAttribute(diagram.dataset.diagramSource);
    if (!source) return;
    void renderDiagramElement(diagram, language, source);
  });
}

async function renderDiagramSvg(language: DiagramLanguage, source: string): Promise<string> {
  if (language === "mermaid") return renderMermaidSvg(source);
  return enqueueD2Render(source);
}

function beginDiagramRender(
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

function applyDiagramSvgIntrinsicSize(diagram: HTMLElement): void {
  const svg = diagram.querySelector<SVGSVGElement>("svg");
  if (!svg) return;

  svg.style.maxWidth = "none";

  const viewBox = parseSvgViewBox(svg.getAttribute("viewBox"));
  if (!viewBox) return;

  const width = svg.getAttribute("width")?.trim();
  const height = svg.getAttribute("height")?.trim();

  if (!width || width.endsWith("%")) {
    svg.setAttribute("width", `${Math.ceil(viewBox.width)}px`);
  }

  if (!height || height.endsWith("%")) {
    svg.setAttribute("height", `${Math.ceil(viewBox.height)}px`);
  }
}

function parseSvgViewBox(value: string | null): { width: number; height: number } | null {
  if (!value) return null;

  const parts = value.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;

  const [, , width, height] = parts;
  if (width <= 0 || height <= 0) return null;

  return { width, height };
}
