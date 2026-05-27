import DOMPurify from "dompurify";

import { decodeMermaidSourceAttribute } from "./mermaidSourceAttribute";

type MermaidTheme = "default" | "dark";

const mermaidZoomMin = 0.4;
const mermaidZoomMax = 4;
const mermaidZoomFactor = 1.12;
const mermaidKeyboardPanStep = 48;
const mermaidKeyboardLargePanStep = 144;

let initializedTheme: MermaidTheme | null = null;
let renderId = 0;
let renderTokenId = 0;
const activeRenderStates = new WeakMap<HTMLElement, MermaidRenderState>();

type MermaidModule = typeof import("mermaid").default;

export type MermaidRenderHandle = {
  fitToViewport: () => void;
};

type MermaidRenderState =
  | { source: string; status: "rendering"; token: number }
  | { handle: MermaidRenderHandle; source: string; status: "rendered"; token: number }
  | { error: unknown; source: string; status: "error"; token: number }
  | { reason: "detached" | "superseded"; source: string; status: "stale"; token: number };

type MermaidRenderContext = {
  canApplyResult: () => boolean;
  markError: (error: unknown) => void;
  markRendered: (handle: MermaidRenderHandle) => void;
};

export function isMermaidLanguage(lang: string | undefined | null): boolean {
  return lang?.trim().split(/\s+/, 1)[0]?.toLowerCase() === "mermaid";
}

export function buildMermaidFallback(source: string): HTMLElement {
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = "language-mermaid";
  code.textContent = source;
  pre.append(code);
  return pre;
}

export function buildMermaidError(source: string, error: unknown): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "preview-mermaid-error";

  const title = document.createElement("div");
  title.className = "preview-mermaid-error-title";
  title.textContent = "Mermaidをレンダリングできませんでした";

  const message = document.createElement("div");
  message.className = "preview-mermaid-error-message";
  message.textContent = "構文を確認してください。";

  const sourceDetails = document.createElement("details");
  sourceDetails.className = "preview-mermaid-error-details";
  const sourceSummary = document.createElement("summary");
  sourceSummary.textContent = "元ソースを表示";
  const sourcePre = document.createElement("pre");
  const sourceCode = document.createElement("code");
  sourceCode.className = "language-mermaid";
  sourceCode.textContent = source;
  sourcePre.append(sourceCode);
  sourceDetails.append(sourceSummary, sourcePre);

  const errorDetails = document.createElement("details");
  errorDetails.className = "preview-mermaid-error-details";
  const errorSummary = document.createElement("summary");
  errorSummary.textContent = "詳細エラー";
  const errorPre = document.createElement("pre");
  errorPre.textContent = error instanceof Error ? error.message : String(error);
  errorDetails.append(errorSummary, errorPre);

  panel.append(title, message, sourceDetails, errorDetails);
  return panel;
}

export async function renderMermaidElement(
  container: HTMLElement,
  source: string
): Promise<MermaidRenderHandle | null> {
  const renderContext = beginMermaidRender(container, source);

  try {
    const mermaid = await loadMermaid();
    const id = `relic-mermaid-${renderId++}`;
    const { svg } = await mermaid.render(id, source);
    if (!renderContext.canApplyResult()) return null;

    const sanitized = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
    if (!renderContext.canApplyResult()) return null;

    container.replaceChildren();
    const diagram = document.createElement("div");
    diagram.className = "preview-mermaid-svg";
    diagram.innerHTML = sanitized;
    applyMermaidSvgIntrinsicSize(diagram);

    const viewport = document.createElement("div");
    viewport.className = "preview-mermaid-panzoom-viewport";
    viewport.tabIndex = 0;
    viewport.setAttribute(
      "aria-label",
      "Mermaid図。+で拡大、-で縮小、0またはfで全体表示、矢印キーで移動、Shift+矢印キーで大きく移動できます。"
    );
    const content = document.createElement("div");
    content.className = "preview-mermaid-panzoom-content";
    content.append(diagram);
    viewport.append(content);
    const handle = initializeMermaidPanZoom(viewport, content);
    container.append(viewport);
    renderContext.markRendered(handle);
    return handle;
  } catch (error) {
    if (!renderContext.canApplyResult()) return null;

    console.warn("Mermaid diagram rendering failed.", error);
    container.replaceChildren(buildMermaidError(source, error));
    renderContext.markError(error);
    return null;
  }
}

export function renderMermaidElements(root: ParentNode): void {
  const diagrams = root.querySelectorAll<HTMLElement>(".preview-mermaid");

  diagrams.forEach((diagram) => {
    const source = diagram.dataset.mermaidSource !== undefined
      ? decodeMermaidSourceAttribute(diagram.dataset.mermaidSource)
      : diagram.querySelector("code")?.textContent;
    if (!source) return;
    void renderMermaidElement(diagram, source);
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

function beginMermaidRender(container: HTMLElement, source: string): MermaidRenderContext {
  const token = ++renderTokenId;
  setMermaidRenderState(container, { source, status: "rendering", token });

  const isCurrentRender = () => activeRenderStates.get(container)?.token === token;

  const markStaleIfCurrent = (reason: "detached" | "superseded") => {
    if (!isCurrentRender()) return;
    setMermaidRenderState(container, { reason, source, status: "stale", token });
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
      setMermaidRenderState(container, { error, source, status: "error", token });
    },
    markRendered: (handle) => {
      if (!isCurrentRender()) return;
      setMermaidRenderState(container, { handle, source, status: "rendered", token });
    }
  };
}

function setMermaidRenderState(container: HTMLElement, state: MermaidRenderState): void {
  activeRenderStates.set(container, state);
  container.dataset.mermaidRenderStatus = state.status;
}

function getPreferredMermaidTheme(): MermaidTheme {
  const rootTheme = document.documentElement.getAttribute("data-theme");

  if (rootTheme === "dark") return "dark";
  if (rootTheme === "light") return "default";

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "default";
}

function applyMermaidSvgIntrinsicSize(diagram: HTMLElement): void {
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

function initializeMermaidPanZoom(viewport: HTMLElement, content: HTMLElement): MermaidRenderHandle {
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
      mermaidZoomMax,
      Math.max(
        mermaidZoomMin,
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
    const clampedZoom = Math.round(Math.min(mermaidZoomMax, Math.max(mermaidZoomMin, nextZoom)) * 100) / 100;

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
    setZoom(event.deltaY < 0 ? zoom * mermaidZoomFactor : zoom / mermaidZoomFactor, event);
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
    viewport.classList.add("preview-mermaid-panzoom-viewport--dragging");
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

    const panStep = event.shiftKey ? mermaidKeyboardLargePanStep : mermaidKeyboardPanStep;

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      event.stopPropagation();
      setZoom(zoom * mermaidZoomFactor, getViewportCenter());
      return;
    }

    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      event.stopPropagation();
      setZoom(zoom / mermaidZoomFactor, getViewportCenter());
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
    viewport.classList.remove("preview-mermaid-panzoom-viewport--dragging");
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
