import { diagramLanguageFor } from "./diagramLanguage";
import { renderDiagramElement } from "./diagramPreview";
import { decodeDiagramSourceAttribute } from "./diagramSourceAttribute";
import { getRenderedDiagramSvgText } from "./diagramSvg";
import { sanitizePreviewHtml, sanitizeSvgHtml } from "./htmlSanitizer";
import type { Translator } from "./i18nModel";
import { escapeHtml, renderMarkdown } from "./previewMarkdown";
import {
  parseRelicDiagramMarkdown,
  type RelicDiagramDocument
} from "../shared/diagramMarkdown";
import { buildDiagramCanvasLayout } from "./components/diagram/diagramGeometry";
import { runWithConcurrency } from "./concurrency";
import { outputCss } from "./outputCss";

export interface BuildPreviewOutputHtmlInput {
  content: string;
  fileName?: string | null;
  path?: string | null;
  t: Translator;
  title?: string | null;
  workspacePath?: string | null;
}

export async function buildPreviewOutputHtml({
  content,
  fileName,
  path,
  t,
  title,
  workspacePath
}: BuildPreviewOutputHtmlInput): Promise<{ defaultFileName: string; html: string; title: string }> {
  const parsedDiagram = parseRelicDiagramMarkdown(content);
  const documentTitle = title?.trim() ||
    (parsedDiagram.ok ? parsedDiagram.value.title : null) ||
    firstH1(content) ||
    outputFileNameFromPath(path) ||
    fileName ||
    "Relic";
  const defaultFileName = safeOutputFileName(outputFileNameFromPath(path) || fileName || firstH1(content) || "relic-preview");

  if (parsedDiagram.ok) {
    return {
      defaultFileName,
      html: wrapOutputHtml(buildDiagramOutputHtml(parsedDiagram.value, documentTitle), documentTitle),
      title: documentTitle
    };
  }

  const root = document.createElement("div");
  root.className = "relic-output-body";
  root.innerHTML = sanitizePreviewHtml(renderMarkdown(content, workspacePath, new Map(), false, t));
  root.style.left = "-10000px";
  root.style.position = "fixed";
  root.style.top = "0";
  document.body.append(root);

  try {
    await renderOutputDiagrams(root, t);
    normalizeOutputDiagramDom(root);
    const sanitizedBody = sanitizePreviewHtml(root.innerHTML);

    return {
      defaultFileName,
      html: wrapOutputHtml(sanitizedBody, documentTitle),
      title: documentTitle
    };
  } finally {
    root.remove();
  }
}

export function safeOutputFileName(value: string): string {
  const sanitized = value
    .trim()
    .replace(/\.md$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 120);

  return sanitized || "relic-preview";
}

export function buildDiagramDefaultFileName(
  markdownFileName: string | null | undefined,
  diagramIndex: number,
  language: "d2" | "mermaid"
): string {
  const base = safeOutputFileName(markdownFileName || "relic");
  return `${base}-diagram-${diagramIndex}-${language}`;
}

export function firstH1(content: string): string | null {
  const match = /^#\s+(.+)$/m.exec(content);
  return match?.[1]?.trim() || null;
}

export function outputFileNameFromPath(path: string | null | undefined): string | null {
  const name = path?.split(/[\\/]/).at(-1)?.replace(/\.md$/i, "").trim();
  return name || null;
}

const maxConcurrentDiagramRender = 2;

async function renderOutputDiagrams(root: ParentNode, t: Translator): Promise<void> {
  const diagrams = Array.from(root.querySelectorAll<HTMLElement>(".preview-diagram"));

  const renderTasks = diagrams.map((diagram) => async () => {
    const language = diagramLanguageFor(diagram.dataset.diagramLanguage);
    if (!language) return;

    const source = diagram.dataset.diagramSource === undefined
      ? ""
      : decodeDiagramSourceAttribute(diagram.dataset.diagramSource);
    if (!source) return;

    await renderDiagramElement(diagram, language, source, t);
  });

  await runWithConcurrency(renderTasks, maxConcurrentDiagramRender);
}

function normalizeOutputDiagramDom(root: ParentNode): void {
  const diagrams = root.querySelectorAll<HTMLElement>(".preview-diagram");

  diagrams.forEach((diagram) => {
    const svg = getRenderedDiagramSvgText(diagram);
    if (!svg) return;

    const outputDiagram = document.createElement("div");
    outputDiagram.className = "relic-output-diagram";
    outputDiagram.innerHTML = sanitizeSvgHtml(svg);
    diagram.replaceChildren(outputDiagram);
    diagram.removeAttribute("data-diagram-source");
  });
}

function wrapOutputHtml(body: string, title: string): string {
  return [
    "<!doctype html>",
    '<html lang="ja">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:;">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${outputCss}</style>`,
    "</head>",
    "<body>",
    `<main class="relic-output-body">${body}</main>`,
    "</body>",
    "</html>"
  ].join("");
}

function buildDiagramOutputHtml(diagram: RelicDiagramDocument, title: string): string {
  return buildDiagramCanvasOutputHtml(diagram, title);
}

function buildDiagramCanvasOutputHtml(
  diagram: RelicDiagramDocument,
  title: string
): string {
  const layout = buildDiagramCanvasLayout(diagram);
  const markerId = "relic-output-diagram-arrow";

  return [
    '<section class="relic-output-diagram-document relic-output-diagram-document--diagram">',
    `<h1>${escapeHtml(title)}</h1>`,
    `<svg class="relic-output-diagram-canvas" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${escapeHtmlAttribute(title)}">`,
    "<defs>",
    `<marker id="${markerId}" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4" viewBox="0 0 8 8">`,
    '<path class="relic-output-diagram-canvas-arrow" d="M 0 0 L 8 4 L 0 8 z" />',
    "</marker>",
    "</defs>",
    ...layout.lines.flatMap((line) => [
      `<path class="relic-output-diagram-canvas-line" d="${escapeHtmlAttribute(line.pathD)}" marker-end="url(#${markerId})" />`,
      line.label.trim()
        ? `<text class="relic-output-diagram-canvas-label" x="${line.labelX}" y="${line.labelY}">${escapeHtml(line.label)}</text>`
        : ""
    ]),
    ...[...layout.nodes].sort((left, right) => outputDiagramNodeLayer(left.node) - outputDiagramNodeLayer(right.node)).map((node) => [
      `<foreignObject x="${node.x}" y="${node.y}" width="${node.node.width}" height="${node.node.height}">`,
      `<div class="${outputDiagramNodeClassName(node.node)}" title="${escapeHtmlAttribute(outputDiagramNodeTitle(node.node))}" xmlns="http://www.w3.org/1999/xhtml">`,
      outputDiagramNodeBodyHtml(node.node),
      "</div>",
      "</foreignObject>"
    ].join("")),
    ...layout.nodes.flatMap((node) => {
      return [
        [
          `<foreignObject x="${node.x}" y="${node.y}" width="${node.node.width}" height="${node.node.height}">`,
          `<div class="${outputDiagramNodeLabelClassName(node.node)}" xmlns="http://www.w3.org/1999/xhtml">`,
          `<span>${escapeHtml(node.node.text)}</span>`,
          "</div>",
          "</foreignObject>"
        ].join("")
      ];
    }),
    "</svg>",
    "</section>"
  ].join("");
}

function outputDiagramNodeClassName(node: RelicDiagramDocument["nodes"][number]): string {
  return `relic-output-diagram-canvas-node relic-output-diagram-canvas-node--shape-${node.shape}`;
}

function outputDiagramNodeLayer(node: RelicDiagramDocument["nodes"][number]): number {
  return node.shape === "area" ? 0 : 1;
}

function outputDiagramNodeBodyHtml(_node: RelicDiagramDocument["nodes"][number]): string {
  return "";
}

function outputDiagramNodeLabelClassName(node: RelicDiagramDocument["nodes"][number]): string {
  return [
    "relic-output-diagram-canvas-node-label",
    `relic-output-diagram-canvas-node-label--shape-${node.shape}`,
    node.shape === "area" ? "relic-output-diagram-canvas-node-label--area" : ""
  ].filter(Boolean).join(" ");
}

function outputDiagramNodeTitle(node: RelicDiagramDocument["nodes"][number]): string {
  return node.text;
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
