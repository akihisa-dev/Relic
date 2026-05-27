import DOMPurify from "dompurify";

import { decodeDiagramSourceAttribute } from "./diagramSourceAttribute";

export type DiagramLanguage = "d2" | "mermaid";
type MermaidTheme = "default" | "dark";
type D2CompileOptions = Omit<import("@terrastruct/d2").CompileRequest, "fs">;

const diagramZoomMin = 0.4;
const diagramZoomMax = 4;
const diagramZoomFactor = 1.12;
const diagramKeyboardPanStep = 48;
const diagramKeyboardLargePanStep = 144;

let initializedTheme: MermaidTheme | null = null;
let renderId = 0;
let renderTokenId = 0;
const activeRenderStates = new WeakMap<HTMLElement, DiagramRenderState>();
let d2RenderQueue: Promise<void> = Promise.resolve();

type MermaidModule = typeof import("mermaid").default;
type D2Renderer = InstanceType<(typeof import("@terrastruct/d2"))["D2"]>;

export type DiagramRenderHandle = {
  fitToViewport: () => void;
};

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

let d2RendererPromise: Promise<D2Renderer> | null = null;

export function diagramLanguageFor(lang: string | undefined | null): DiagramLanguage | null {
  const token = lang?.trim().split(/\s+/, 1)[0]?.toLowerCase();

  if (token === "mermaid") return "mermaid";
  if (token === "d2") return "d2";
  return null;
}

export function buildDiagramFallback(language: DiagramLanguage, source: string): HTMLElement {
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = `language-${language}`;
  code.textContent = source;
  pre.append(code);
  return pre;
}

export function buildDiagramError(language: DiagramLanguage, source: string, error: unknown): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "preview-diagram-error";
  const errorText = error instanceof Error ? error.message : String(error);

  const title = document.createElement("div");
  title.className = "preview-diagram-error-title";
  title.textContent = `${diagramLabel(language)}をレンダリングできませんでした`;

  const message = document.createElement("div");
  message.className = "preview-diagram-error-message";
  message.textContent = "構文を確認してください。";

  const sourceDetails = document.createElement("details");
  sourceDetails.className = "preview-diagram-error-details";
  const sourceSummary = document.createElement("summary");
  sourceSummary.textContent = "元ソースを表示";
  const sourcePre = document.createElement("pre");
  const sourceCode = document.createElement("code");
  sourceCode.className = `language-${language}`;
  sourceCode.textContent = source;
  sourcePre.append(sourceCode);
  sourceDetails.append(sourceSummary, sourcePre, createDiagramErrorCopyButton("元ソースをコピー", source));

  const errorDetails = document.createElement("details");
  errorDetails.className = "preview-diagram-error-details";
  const errorSummary = document.createElement("summary");
  errorSummary.textContent = "詳細エラー";
  const errorPre = document.createElement("pre");
  errorPre.textContent = errorText;
  errorDetails.append(errorSummary, errorPre, createDiagramErrorCopyButton("詳細エラーをコピー", errorText));

  panel.append(title, message, sourceDetails, errorDetails);
  return panel;
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

async function loadMermaid(): Promise<MermaidModule> {
  const mermaid = (await import("mermaid")).default;
  const theme = getPreferredMermaidTheme();

  if (initializedTheme !== theme) {
    mermaid.initialize({
      theme,
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      securityLevel: "strict",
      startOnLoad: false
    });
    initializedTheme = theme;
  }

  return mermaid;
}

async function loadD2(): Promise<D2Renderer> {
  if (!d2RendererPromise) {
    d2RendererPromise = import("@terrastruct/d2").then(({ D2 }) => new D2());
  }

  return d2RendererPromise;
}

async function renderDiagramSvg(language: DiagramLanguage, source: string): Promise<string> {
  if (language === "mermaid") {
    const mermaid = await loadMermaid();
    const id = `relic-mermaid-${renderId++}`;
    const { svg } = await mermaid.render(id, source);
    return svg;
  }

  return enqueueD2Render(source);
}

function enqueueD2Render(source: string): Promise<string> {
  const renderTask = d2RenderQueue.then(() => renderD2Svg(source));
  d2RenderQueue = renderTask.then(
    () => undefined,
    () => undefined
  );

  return renderTask;
}

async function renderD2Svg(source: string): Promise<string> {
  const d2 = await loadD2();
  const compileOptions = getD2CompileOptions();
  const result = await d2.compile(source, compileOptions);
  const svg = await d2.render(result.diagram, {
    ...(result.renderOptions ?? {}),
    noXMLTag: true
  });

  if (typeof svg !== "string") {
    throw new Error("D2 renderer did not return SVG text.");
  }

  return svg;
}

function getD2CompileOptions(): D2CompileOptions {
  return { layout: "dagre" } as unknown as D2CompileOptions;
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

function diagramLabel(language: DiagramLanguage): string {
  return language === "d2" ? "D2" : "Mermaid";
}

function createDiagramErrorCopyButton(label: string, text: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "preview-diagram-error-copy-button";
  button.textContent = label;

  const stopInteraction = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  button.addEventListener("pointerdown", stopInteraction);
  button.addEventListener("mousedown", stopInteraction);
  button.addEventListener("click", (event) => {
    stopInteraction(event);

    void navigator.clipboard?.writeText(text)
      .then(() => {
        button.textContent = "コピーしました";
        window.setTimeout(() => {
          button.textContent = label;
        }, 1200);
      })
      .catch(() => {
        button.textContent = "コピーできませんでした";
        window.setTimeout(() => {
          button.textContent = label;
        }, 1600);
      });
  });

  return button;
}

function getPreferredMermaidTheme(): MermaidTheme {
  const rootTheme = document.documentElement.getAttribute("data-theme");

  if (rootTheme === "dark") return "dark";
  if (rootTheme === "light") return "default";

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "default";
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

function initializeDiagramPanZoom(viewport: HTMLElement, content: HTMLElement): DiagramRenderHandle {
  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOriginX = 0;
  let dragOriginY = 0;
  let activePointerId: number | null = null;
  let hasUserTransformed = false;
  let transformFrameId: number | null = null;

  const applyTransform = () => {
    content.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
  };

  const updateTransformNow = () => {
    if (transformFrameId !== null) {
      window.cancelAnimationFrame(transformFrameId);
      transformFrameId = null;
    }
    applyTransform();
  };

  const scheduleTransformUpdate = () => {
    if (transformFrameId !== null) return;

    transformFrameId = window.requestAnimationFrame(() => {
      transformFrameId = null;
      applyTransform();
    });
  };

  const fitToViewport = () => {
    const padding = 24;
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const contentRect = content.getBoundingClientRect();
    const contentWidth = content.scrollWidth || contentRect.width;
    const contentHeight = content.scrollHeight || contentRect.height;

    if (viewportWidth <= 0 || viewportHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) return;

    const availableWidth = viewportWidth - padding * 2;
    const availableHeight = viewportHeight - padding * 2;
    if (availableWidth <= 0 || availableHeight <= 0) return;

    const fitZoom = Math.round(Math.min(
      diagramZoomMax,
      Math.max(
        diagramZoomMin,
        Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1)
      )
    ) * 100) / 100;

    zoom = fitZoom;
    offsetX = Math.round(((viewportWidth - contentWidth * fitZoom) / 2) * 100) / 100;
    offsetY = Math.round(((viewportHeight - contentHeight * fitZoom) / 2) * 100) / 100;
    hasUserTransformed = false;
    updateTransformNow();
  };

  const setZoom = (nextZoom: number, anchor?: { clientX: number; clientY: number }) => {
    const previousZoom = zoom;
    const clampedZoom = Math.round(Math.min(diagramZoomMax, Math.max(diagramZoomMin, nextZoom)) * 100) / 100;

    if (anchor && clampedZoom !== previousZoom) {
      const rect = viewport.getBoundingClientRect();
      const mouseX = anchor.clientX - rect.left;
      const mouseY = anchor.clientY - rect.top;
      const contentX = (mouseX - offsetX) / previousZoom;
      const contentY = (mouseY - offsetY) / previousZoom;
      offsetX = Math.round((mouseX - contentX * clampedZoom) * 100) / 100;
      offsetY = Math.round((mouseY - contentY * clampedZoom) * 100) / 100;
    }

    zoom = clampedZoom;
    hasUserTransformed = true;
    scheduleTransformUpdate();
  };

  const panBy = (deltaX: number, deltaY: number) => {
    offsetX = Math.round((offsetX + deltaX) * 100) / 100;
    offsetY = Math.round((offsetY + deltaY) * 100) / 100;
    hasUserTransformed = true;
    scheduleTransformUpdate();
  };

  const getViewportCenter = () => {
    const rect = viewport.getBoundingClientRect();
    return {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };
  };

  const resizeObserver = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => {
        if (hasUserTransformed) return;

        window.requestAnimationFrame(() => {
          if (!hasUserTransformed && viewport.isConnected) fitToViewport();
        });
      })
    : null;

  resizeObserver?.observe(viewport);

  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setZoom(event.deltaY < 0 ? zoom * diagramZoomFactor : zoom / diagramZoomFactor, event);
  });
  viewport.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  viewport.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    isDragging = true;
    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragOriginX = offsetX;
    dragOriginY = offsetY;
    viewport.classList.add("preview-diagram-panzoom-viewport--dragging");
    viewport.setPointerCapture?.(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!isDragging) return;

    event.preventDefault();
    event.stopPropagation();
    offsetX = dragOriginX + event.clientX - dragStartX;
    offsetY = dragOriginY + event.clientY - dragStartY;
    hasUserTransformed = true;
    scheduleTransformUpdate();
  });
  viewport.addEventListener("pointerup", (event) => {
    event.preventDefault();
    event.stopPropagation();
    stopDragging(event.pointerId);
  });
  viewport.addEventListener("pointercancel", (event) => {
    event.preventDefault();
    event.stopPropagation();
    stopDragging(event.pointerId);
  });
  viewport.addEventListener("dragstart", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  viewport.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const panStep = event.shiftKey ? diagramKeyboardLargePanStep : diagramKeyboardPanStep;

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      event.stopPropagation();
      setZoom(zoom * diagramZoomFactor, getViewportCenter());
      return;
    }

    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      event.stopPropagation();
      setZoom(zoom / diagramZoomFactor, getViewportCenter());
      return;
    }

    if (event.key === "0" || event.key.toLowerCase() === "f") {
      event.preventDefault();
      event.stopPropagation();
      fitToViewport();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      panBy(panStep, 0);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      panBy(-panStep, 0);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      panBy(0, panStep);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      panBy(0, -panStep);
    }
  });
  updateTransformNow();
  window.requestAnimationFrame(() => {
    if (!hasUserTransformed && viewport.isConnected) fitToViewport();
  });
  return { fitToViewport };

  function stopDragging(pointerId: number): void {
    if (!isDragging) return;

    isDragging = false;
    viewport.classList.remove("preview-diagram-panzoom-viewport--dragging");
    releaseActivePointerCapture(pointerId);
    activePointerId = null;
  }

  function releaseActivePointerCapture(fallbackPointerId: number): void {
    const pointerId = activePointerId ?? fallbackPointerId;

    try {
      if (!viewport.hasPointerCapture || viewport.hasPointerCapture(pointerId)) {
        viewport.releasePointerCapture?.(pointerId);
      }
    } catch {
      // Pointer capture may already be gone after pointercancel.
    }
  }
}
