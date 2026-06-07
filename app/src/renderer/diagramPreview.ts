import { enqueueD2Render } from "./d2Renderer";
import { buildDiagramError } from "./diagramErrorView";
import { diagramLabel, diagramLanguageFor, type DiagramLanguage } from "./diagramLanguage";
import { assertDiagramSourceWithinLimit, withDiagramRenderTimeout } from "./diagramLimits";
import { initializeDiagramPanZoom, type DiagramRenderHandle } from "./diagramPanZoom";
import { beginDiagramRender } from "./diagramRenderState";
import { decodeDiagramSourceAttribute } from "./diagramSourceAttribute";
import { sanitizeSvgHtml } from "./htmlSanitizer";
import { createTranslator, type Translator } from "./i18nModel";
import { renderMermaidSvg } from "./mermaidRenderer";

export { diagramLanguageFor, type DiagramLanguage } from "./diagramLanguage";
export { buildDiagramError } from "./diagramErrorView";
export type { DiagramRenderHandle } from "./diagramPanZoom";

let closeActiveDiagramOverlay: (() => void) | null = null;

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
  source: string,
  t: Translator = createTranslator("system"),
  options: { showExpandButton?: boolean } = {}
): Promise<DiagramRenderHandle | null> {
  const renderContext = beginDiagramRender(container, language, source);

  try {
    const svg = await renderDiagramSvg(language, source);
    if (!renderContext.canApplyResult()) return null;

    const sanitized = sanitizeSvgHtml(svg);
    if (!renderContext.canApplyResult()) return null;

    container.replaceChildren();
    const diagram = document.createElement("div");
    diagram.className = `preview-diagram-svg preview-diagram-svg--${language}`;
    diagram.innerHTML = sanitized;
    if (!diagram.querySelector("svg")) {
      throw new Error(`${diagramLabel(language)} renderer did not return SVG text.`);
    }
    applyDiagramSvgIntrinsicSize(diagram);

    const viewport = document.createElement("div");
    viewport.className = "preview-diagram-panzoom-viewport";
    viewport.tabIndex = 0;
    viewport.setAttribute(
      "aria-label",
      t("diagram.panZoomLabel", { language: diagramLabel(language) })
    );
    const content = document.createElement("div");
    content.className = "preview-diagram-panzoom-content";
    content.append(diagram);
    viewport.append(content);
    const handle = initializeDiagramPanZoom(viewport, content);
    if (options.showExpandButton ?? true) {
      const actions = document.createElement("div");
      actions.className = "preview-diagram-action-bar";
      actions.append(createDiagramExpandButton(diagram, language, t));
      container.append(actions);
    }
    container.append(viewport);
    renderContext.markRendered(handle);
    return handle;
  } catch (error) {
    if (!renderContext.canApplyResult()) return null;

    console.warn(`${diagramLabel(language)} diagram rendering failed.`, error);
    container.replaceChildren(buildDiagramError(language, source, error, t));
    renderContext.markError(error);
    return null;
  }
}

export function createDiagramExpandButton(
  diagram: HTMLElement,
  language: DiagramLanguage,
  t: Translator = createTranslator("system")
): HTMLButtonElement {
  const label = t("diagram.expand");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "preview-diagram-expand-button";
  button.textContent = label;
  button.setAttribute("aria-label", t("diagram.expandAria", { language: diagramLabel(language) }));
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openDiagramOverlay(diagram, language, t);
  });

  return button;
}

export function openDiagramOverlay(
  diagram: HTMLElement,
  language: DiagramLanguage,
  t: Translator = createTranslator("system")
): void {
  closeActiveDiagramOverlay?.();

  const overlay = document.createElement("div");
  overlay.className = "preview-diagram-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", t("diagram.expandedLabel", { language: diagramLabel(language) }));

  const panel = document.createElement("div");
  panel.className = "preview-diagram-overlay-panel";

  const toolbar = document.createElement("div");
  toolbar.className = "preview-diagram-overlay-toolbar";

  const title = document.createElement("div");
  title.className = "preview-diagram-overlay-title";
  title.textContent = t("diagram.expandedTitle", { language: diagramLabel(language) });

  const controls = document.createElement("div");
  controls.className = "preview-diagram-overlay-controls";

  const fitButton = document.createElement("button");
  fitButton.type = "button";
  fitButton.className = "preview-diagram-overlay-button";
  fitButton.textContent = t("diagram.fit");
  fitButton.setAttribute("aria-label", t("diagram.fitAria", { language: diagramLabel(language) }));

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "preview-diagram-overlay-button";
  closeButton.textContent = t("diagram.closeExpanded");
  closeButton.setAttribute("aria-label", t("diagram.closeExpandedAria"));

  controls.append(fitButton, closeButton);
  toolbar.append(title, controls);

  const viewport = document.createElement("div");
  viewport.className = "preview-diagram-panzoom-viewport preview-diagram-panzoom-viewport--expanded";
  viewport.tabIndex = 0;
  viewport.setAttribute(
    "aria-label",
    t("diagram.panZoomLabel", { language: diagramLabel(language) })
  );

  const content = document.createElement("div");
  content.className = "preview-diagram-panzoom-content";
  content.append(diagram.cloneNode(true));
  viewport.append(content);
  panel.append(toolbar, viewport);
  overlay.append(panel);

  const closeOverlay = () => {
    overlay.remove();
    document.removeEventListener("keydown", onDocumentKeyDown);
    if (closeActiveDiagramOverlay === closeOverlay) {
      closeActiveDiagramOverlay = null;
    }
  };

  const onDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;

    event.preventDefault();
    closeOverlay();
  };

  closeButton.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeOverlay();
  });
  document.addEventListener("keydown", onDocumentKeyDown);
  closeActiveDiagramOverlay = closeOverlay;
  document.body.append(overlay);

  const handle = initializeDiagramPanZoom(viewport, content);
  fitButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handle.fitToViewport();
  });
  closeButton.focus();
  window.requestAnimationFrame(() => handle.fitToViewport());
}

export function renderDiagramElements(root: ParentNode, t: Translator = createTranslator("system")): void {
  const diagrams = root.querySelectorAll<HTMLElement>(".preview-diagram");

  diagrams.forEach((diagram) => {
    const language = diagramLanguageFor(diagram.dataset.diagramLanguage);
    if (!language) return;

    const source = diagram.dataset.diagramSource === undefined
      ? ""
      : decodeDiagramSourceAttribute(diagram.dataset.diagramSource);
    if (!source) return;
    void renderDiagramElement(diagram, language, source, t);
  });
}

async function renderDiagramSvg(language: DiagramLanguage, source: string): Promise<string> {
  assertDiagramSourceWithinLimit(language, source);

  const operation = language === "mermaid"
    ? renderMermaidSvg(source)
    : enqueueD2Render(source);

  return withDiagramRenderTimeout(operation, language);
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

  const width = parts[2];
  const height = parts[3];
  if (typeof width !== "number" || typeof height !== "number") return null;
  if (width <= 0 || height <= 0) return null;

  return { width, height };
}
