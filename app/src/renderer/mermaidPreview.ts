import DOMPurify from "dompurify";

import { decodeMermaidSourceAttribute } from "./mermaidSourceAttribute";

type MermaidTheme = "default" | "dark";

const mermaidZoomMin = 0.4;
const mermaidZoomMax = 4;
const mermaidZoomStep = 0.2;

let initializedTheme: MermaidTheme | null = null;
let renderId = 0;

type MermaidModule = typeof import("mermaid").default;

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

export async function renderMermaidElement(container: HTMLElement, source: string): Promise<void> {
  try {
    const mermaid = await loadMermaid();
    const id = `relic-mermaid-${renderId++}`;
    const { svg } = await mermaid.render(id, source);
    const sanitized = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });

    container.replaceChildren();
    const diagram = document.createElement("div");
    diagram.className = "preview-mermaid-svg";
    diagram.innerHTML = sanitized;
    applyMermaidSvgIntrinsicSize(diagram);

    const viewport = document.createElement("div");
    viewport.className = "preview-mermaid-panzoom-viewport";
    const content = document.createElement("div");
    content.className = "preview-mermaid-panzoom-content";
    content.append(diagram);
    viewport.append(content);
    initializeMermaidPanZoom(viewport, content);
    container.append(viewport);
  } catch (error) {
    console.warn("Mermaid diagram rendering failed.", error);
    container.replaceChildren(buildMermaidFallback(source));
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

function initializeMermaidPanZoom(viewport: HTMLElement, content: HTMLElement): void {
  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOriginX = 0;
  let dragOriginY = 0;
  let activePointerId: number | null = null;

  const updateTransform = () => {
    content.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
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
    updateTransform();
  };

  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    setZoom(zoom + (event.deltaY < 0 ? mermaidZoomStep : -mermaidZoomStep), event);
  });
  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    event.preventDefault();
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
    offsetX = dragOriginX + event.clientX - dragStartX;
    offsetY = dragOriginY + event.clientY - dragStartY;
    updateTransform();
  });
  viewport.addEventListener("pointerup", (event) => {
    stopDragging(event.pointerId);
  });
  viewport.addEventListener("pointercancel", (event) => stopDragging(event.pointerId));
  viewport.addEventListener("dragstart", (event) => event.preventDefault());
  updateTransform();

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
