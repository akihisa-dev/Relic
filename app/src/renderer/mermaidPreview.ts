import DOMPurify from "dompurify";

import { decodeMermaidSourceAttribute } from "./mermaidSourceAttribute";

type MermaidTheme = "default" | "dark";

const mermaidZoomMin = 0.4;
const mermaidZoomMax = 4;
const mermaidZoomStep = 0.2;

let initializedTheme: MermaidTheme | null = null;
let closeCurrentMermaidOverlay: (() => void) | null = null;
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
    diagram.addEventListener("click", () => openMermaidZoomOverlay(diagram));
    container.append(buildMermaidExpandButton(diagram), diagram);
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

function buildMermaidExpandButton(diagram: HTMLElement): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "preview-mermaid-expand-button";
  button.textContent = "拡大";
  button.title = "Mermaid図を拡大表示";
  button.setAttribute("aria-label", "Mermaid図を拡大表示");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openMermaidZoomOverlay(diagram);
  });
  return button;
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

function openMermaidZoomOverlay(diagram: HTMLElement): void {
  closeCurrentMermaidOverlay?.();

  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const overlay = document.createElement("div");
  overlay.className = "preview-mermaid-overlay";
  overlay.setAttribute("aria-label", "Mermaid図の拡大表示");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("role", "dialog");
  overlay.tabIndex = -1;

  const surface = document.createElement("div");
  surface.className = "preview-mermaid-overlay-surface";

  const toolbar = document.createElement("div");
  toolbar.className = "preview-mermaid-overlay-toolbar";

  const zoomStatus = document.createElement("span");
  zoomStatus.className = "preview-mermaid-zoom-status";
  zoomStatus.setAttribute("aria-label", "現在の拡大率");
  zoomStatus.setAttribute("aria-live", "polite");

  const viewport = document.createElement("div");
  viewport.className = "preview-mermaid-overlay-viewport";

  const content = document.createElement("div");
  content.className = "preview-mermaid-overlay-content";

  const overlayDiagram = diagram.cloneNode(true) as HTMLElement;
  overlayDiagram.classList.add("preview-mermaid-svg--overlay");
  content.append(overlayDiagram);
  viewport.append(content);

  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOriginX = 0;
  let dragOriginY = 0;

  const updateTransform = () => {
    content.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
    zoomStatus.textContent = `${Math.round(zoom * 100)}%`;
  };

  const setZoom = (nextZoom: number) => {
    zoom = Math.min(mermaidZoomMax, Math.max(mermaidZoomMin, nextZoom));
    updateTransform();
  };

  const close = () => {
    document.removeEventListener("keydown", handleDocumentKeyDown);
    overlay.remove();
    closeCurrentMermaidOverlay = null;
    previousFocus?.focus();
  };
  closeCurrentMermaidOverlay = close;

  const handleZoomIn = () => setZoom(zoom + mermaidZoomStep);
  const handleZoomOut = () => setZoom(zoom - mermaidZoomStep);
  const handleReset = () => {
    zoom = 1;
    offsetX = 0;
    offsetY = 0;
    updateTransform();
  };

  const zoomOutButton = buildOverlayButton("縮小", "Mermaid図を縮小", handleZoomOut);
  const resetButton = buildOverlayButton("リセット", "Mermaid図の拡大率と位置をリセット", handleReset);
  const zoomInButton = buildOverlayButton("拡大", "Mermaid図を拡大", handleZoomIn);
  const closeButton = buildOverlayButton("閉じる", "Mermaid拡大表示を閉じる", close);

  toolbar.append(zoomOutButton, resetButton, zoomInButton, zoomStatus, closeButton);
  surface.append(toolbar, viewport);
  overlay.append(surface);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  viewport.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;

    event.preventDefault();
    setZoom(zoom + (event.deltaY < 0 ? mermaidZoomStep : -mermaidZoomStep));
  });
  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    isDragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragOriginX = offsetX;
    dragOriginY = offsetY;
    viewport.classList.add("preview-mermaid-overlay-viewport--dragging");
    viewport.setPointerCapture?.(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!isDragging) return;

    offsetX = dragOriginX + event.clientX - dragStartX;
    offsetY = dragOriginY + event.clientY - dragStartY;
    updateTransform();
  });
  viewport.addEventListener("pointerup", (event) => {
    if (!isDragging) return;

    isDragging = false;
    viewport.classList.remove("preview-mermaid-overlay-viewport--dragging");
    viewport.releasePointerCapture?.(event.pointerId);
  });
  viewport.addEventListener("pointercancel", () => {
    isDragging = false;
    viewport.classList.remove("preview-mermaid-overlay-viewport--dragging");
  });
  document.addEventListener("keydown", handleDocumentKeyDown);
  document.body.append(overlay);
  updateTransform();
  closeButton.focus();

  function handleDocumentKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;

    event.preventDefault();
    close();
  }
}

function buildOverlayButton(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "preview-mermaid-overlay-button";
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}
