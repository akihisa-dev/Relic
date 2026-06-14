import { diagramLanguageFor } from "./diagramLanguage";
import { renderDiagramElement } from "./diagramPreview";
import { decodeDiagramSourceAttribute } from "./diagramSourceAttribute";
import { getRenderedDiagramSvgText } from "./diagramSvg";
import { sanitizePreviewHtml, sanitizeSvgHtml } from "./htmlSanitizer";
import type { Translator } from "./i18nModel";
import { escapeHtml, renderMarkdown } from "./previewMarkdown";
import {
  parseRelicDiagramMarkdown,
  type RelicDiagramDocument,
  type RelicWhyTreeLabels,
  type RelicWhyTreeNode
} from "../shared/diagramMarkdown";
import { buildDiagramCanvasLayout, nodeFileName } from "./components/diagram/diagramGeometry";

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

async function renderOutputDiagrams(root: ParentNode, t: Translator): Promise<void> {
  const diagrams = Array.from(root.querySelectorAll<HTMLElement>(".preview-diagram"));

  await Promise.all(diagrams.map(async (diagram) => {
    const language = diagramLanguageFor(diagram.dataset.diagramLanguage);
    if (!language) return;

    const source = diagram.dataset.diagramSource === undefined
      ? ""
      : decodeDiagramSourceAttribute(diagram.dataset.diagramSource);
    if (!source) return;

    await renderDiagramElement(diagram, language, source, t);
  }));
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
  return diagram.type === "why-tree"
    ? buildWhyTreeOutputHtml(diagram, title)
    : buildRelationshipOutputHtml(diagram, title);
}

function buildRelationshipOutputHtml(
  diagram: Extract<RelicDiagramDocument, { type: "relationship" | "free-drawing" }>,
  title: string
): string {
  const layout = buildDiagramCanvasLayout(diagram);
  const markerId = "relic-output-diagram-arrow";

  return [
    '<section class="relic-output-diagram-document relic-output-diagram-document--relationship">',
    `<h1>${escapeHtml(title)}</h1>`,
    `<svg class="relic-output-relationship" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${escapeHtmlAttribute(title)}">`,
    "<defs>",
    `<marker id="${markerId}" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4" viewBox="0 0 8 8">`,
    '<path class="relic-output-relationship-arrow" d="M 0 0 L 8 4 L 0 8 z" />',
    "</marker>",
    "</defs>",
    ...layout.lines.flatMap((line) => [
      `<path class="relic-output-relationship-line" d="${escapeHtmlAttribute(line.pathD)}" marker-end="url(#${markerId})" />`,
      line.label.trim()
        ? `<text class="relic-output-relationship-label" x="${line.labelX}" y="${line.labelY}">${escapeHtml(line.label)}</text>`
        : ""
    ]),
    ...layout.nodes.map((node) => [
      `<foreignObject x="${node.x}" y="${node.y}" width="${node.node.width}" height="${node.node.height}">`,
      `<div class="${outputDiagramNodeClassName(node.node)}" title="${escapeHtmlAttribute(outputDiagramNodeTitle(node.node))}" xmlns="http://www.w3.org/1999/xhtml">`,
      `<span>${escapeHtml(outputDiagramNodeText(node.node))}</span>`,
      "</div>",
      "</foreignObject>"
    ].join("")),
    "</svg>",
    "</section>"
  ].join("");
}

function outputDiagramNodeClassName(node: Extract<RelicDiagramDocument, { type: "relationship" | "free-drawing" }>["nodes"][number]): string {
  return "shape" in node
    ? `relic-output-relationship-node relic-output-relationship-node--shape-${node.shape}`
    : "relic-output-relationship-node";
}

function outputDiagramNodeText(node: Extract<RelicDiagramDocument, { type: "relationship" | "free-drawing" }>["nodes"][number]): string {
  return "file" in node ? nodeFileName(node.file) : node.text;
}

function outputDiagramNodeTitle(node: Extract<RelicDiagramDocument, { type: "relationship" | "free-drawing" }>["nodes"][number]): string {
  return "file" in node ? node.file : node.text;
}

function buildWhyTreeOutputHtml(
  diagram: Extract<RelicDiagramDocument, { type: "why-tree" }>,
  title: string
): string {
  return [
    '<section class="relic-output-diagram-document relic-output-diagram-document--why-tree">',
    `<h1>${escapeHtml(title)}</h1>`,
    '<div class="relic-output-why-tree">',
    buildWhyTreeNodeOutputHtml(diagram.phenomenon, diagram.labels, "root"),
    "</div>",
    "</section>"
  ].join("");
}

function buildWhyTreeNodeOutputHtml(
  node: RelicWhyTreeNode,
  labels: RelicWhyTreeLabels,
  kind: "node" | "root"
): string {
  const supplements = [
    ...node.facts.map((value) => ({ label: labels.fact, modifier: "fact", value })),
    ...node.solutions.map((value) => ({ label: labels.solution, modifier: "solution", value })),
    ...node.actions.map((value) => ({ label: labels.action, modifier: "action", value }))
  ].filter((item) => item.value.trim() !== "");

  return [
    '<article class="relic-output-why-tree-item">',
    '<div class="relic-output-why-tree-node">',
    `<div class="relic-output-why-tree-node-label">${escapeHtml(kind === "root" ? labels.root : labels.node)}</div>`,
    `<div class="relic-output-why-tree-node-title">${multilineTextToHtml(node.title)}</div>`,
    supplements.length > 0
      ? [
          '<div class="relic-output-why-tree-supplements">',
          ...supplements.map((item) => [
            `<div class="relic-output-why-tree-supplement relic-output-why-tree-supplement--${item.modifier}">`,
            `<span class="relic-output-why-tree-supplement-label">${escapeHtml(item.label)}</span>`,
            `<span class="relic-output-why-tree-supplement-text">${multilineTextToHtml(item.value)}</span>`,
            "</div>"
          ].join("")),
          "</div>"
        ].join("")
      : "",
    "</div>",
    node.whys.length > 0
      ? [
          '<div class="relic-output-why-tree-children">',
          ...node.whys.map((child) => buildWhyTreeNodeOutputHtml(child, labels, "node")),
          "</div>"
        ].join("")
      : "",
    "</article>"
  ].join("");
}

function multilineTextToHtml(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

const outputCss = `
@page {
  margin: 12.7mm 13.8mm;
  size: A4;
}

html,
body {
  background: #ffffff;
  color: #111111;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif;
  font-size: 12pt;
  line-height: 1.62;
  margin: 0;
  padding: 0;
}

.relic-output-body {
  box-sizing: border-box;
  margin: 0 auto;
  max-width: 176mm;
  width: 100%;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  break-after: avoid;
  color: #111111;
  font-weight: 700;
  line-height: 1.32;
  margin: 1.35em 0 0.45em;
  page-break-after: avoid;
}

h1 { font-size: 1.85em; }
h2 { font-size: 1.48em; }
h3 { font-size: 1.22em; }

p,
blockquote,
pre,
table,
.preview-diagram {
  break-inside: avoid;
  page-break-inside: avoid;
}

p {
  margin: 0.62em 0;
}

a,
.wikilink {
  background: none;
  border: 0;
  color: #111111;
  font: inherit;
  padding: 0;
  text-decoration: underline;
}

blockquote {
  border-left: 3px solid #b8b8b8;
  color: #333333;
  margin: 0.75em 0;
  padding-left: 1em;
}

code {
  background: #f2f2f2;
  border-radius: 3px;
  color: #111111;
  font-family: Menlo, Consolas, "Courier New", monospace;
  font-size: 0.9em;
  padding: 0.12em 0.32em;
}

pre {
  background: #f6f6f6;
  border: 1px solid #dddddd;
  border-radius: 5px;
  color: #111111;
  overflow-wrap: anywhere;
  padding: 10px 12px;
  white-space: pre-wrap;
}

pre code {
  background: transparent;
  padding: 0;
}

table {
  border-collapse: collapse;
  display: block;
  max-width: 100%;
  overflow-wrap: anywhere;
  overflow-x: auto;
  width: 100%;
}

th,
td {
  border: 1px solid #cfcfcf;
  padding: 5px 8px;
  text-align: left;
  vertical-align: top;
}

th {
  background: #f1f1f1;
  font-weight: 700;
}

hr {
  border: 0;
  border-top: 1px solid #d8d8d8;
  margin: 1.25em 0;
}

mark {
  background: #fff4a8;
  color: #111111;
}

.preview-checkbox {
  accent-color: #111111;
}

.preview-image-placeholder,
.preview-file-embed {
  border: 1px solid #d8d8d8;
  border-radius: 4px;
  color: #333333;
}

.preview-image-placeholder {
  display: inline-block;
  padding: 1px 5px;
}

.preview-file-embed {
  margin: 1em 0;
  padding: 10px 12px;
}

.preview-file-embed-title {
  color: #333333;
  font-size: 0.88em;
  font-weight: 700;
  margin-bottom: 6px;
}

.preview-diagram {
  margin: 1em 0;
  max-width: 100%;
}

.relic-output-diagram {
  border: 1px solid #d8d8d8;
  border-radius: 5px;
  box-sizing: border-box;
  overflow: hidden;
  padding: 8px;
}

.relic-output-diagram svg {
  display: block;
  height: auto;
  max-height: 240mm;
  max-width: 100%;
}

.preview-diagram-error {
  background: #fff6f4;
  border: 1px solid #e7b2aa;
  border-radius: 5px;
  color: #111111;
  padding: 10px 12px;
}

.relic-output-diagram-document {
  box-sizing: border-box;
  margin: 0 auto;
  max-width: 176mm;
  width: 100%;
}

.relic-output-diagram-document h1 {
  color: #111111;
  font-size: 1.85em;
  line-height: 1.32;
  margin: 0 0 14px;
}

.relic-output-relationship {
  background: transparent;
  box-sizing: border-box;
  display: block;
  height: auto;
  max-height: 235mm;
  max-width: 100%;
  width: 100%;
}

.relic-output-relationship-line {
  fill: none;
  stroke: #4c4a45;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.5;
}

.relic-output-relationship-arrow {
  fill: #4c4a45;
}

.relic-output-relationship-label {
  fill: #272521;
  font-size: 14px;
  paint-order: stroke;
  stroke: #ffffff;
  stroke-linejoin: round;
  stroke-width: 5px;
  text-anchor: middle;
}

.relic-output-relationship-node {
  align-items: center;
  background: #ffffff;
  border: 1.5px solid #80786c;
  border-radius: 6px;
  box-shadow: 0 3px 8px rgba(30, 26, 18, 0.12);
  box-sizing: border-box;
  color: #1f1d19;
  display: flex;
  font-size: 14px;
  font-weight: 650;
  height: 100%;
  justify-content: center;
  line-height: 1.35;
  overflow-wrap: anywhere;
  padding: 10px;
  text-align: center;
  width: 100%;
}

.relic-output-relationship-node--shape-terminator {
  border-radius: 999px;
}

.relic-output-relationship-node--shape-decision {
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  padding: 18px 34px;
}

.relic-output-relationship-node--shape-input-output {
  clip-path: polygon(14% 0, 100% 0, 86% 100%, 0 100%);
  padding-left: 28px;
  padding-right: 28px;
}

.relic-output-relationship-node--shape-note {
  border-radius: 5px;
  position: relative;
}

.relic-output-relationship-node--shape-note::after {
  background: #f7f5ef;
  border-bottom: 1.5px solid #80786c;
  border-left: 1.5px solid #80786c;
  content: "";
  height: 16px;
  position: absolute;
  right: -1.5px;
  top: -1.5px;
  width: 16px;
}

.relic-output-why-tree {
  display: flex;
  justify-content: center;
  overflow-x: auto;
  padding: 8px 0 0;
}

.relic-output-why-tree-item {
  align-items: center;
  break-inside: avoid;
  display: flex;
  flex-direction: column;
  page-break-inside: avoid;
}

.relic-output-why-tree-node {
  background: #ffffff;
  border: 1.5px solid #80786c;
  border-radius: 6px;
  box-shadow: 0 3px 8px rgba(30, 26, 18, 0.10);
  box-sizing: border-box;
  color: #1f1d19;
  max-width: 230px;
  min-width: 150px;
  padding: 9px 10px;
}

.relic-output-why-tree-node-label,
.relic-output-why-tree-supplement-label {
  color: #696257;
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0;
  margin-bottom: 4px;
}

.relic-output-why-tree-node-title {
  font-size: 13px;
  font-weight: 650;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.relic-output-why-tree-supplements {
  border-top: 1px solid #e2ddd4;
  display: grid;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
}

.relic-output-why-tree-supplement {
  background: #f7f5ef;
  border: 1px solid #ded8cd;
  border-radius: 5px;
  padding: 6px 7px;
}

.relic-output-why-tree-supplement-text {
  display: block;
  font-size: 11px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.relic-output-why-tree-children {
  display: flex;
  gap: 18px;
  justify-content: center;
  margin-top: 30px;
  position: relative;
}

.relic-output-why-tree-children::before {
  background: #80786c;
  content: "";
  height: 22px;
  left: 50%;
  position: absolute;
  top: -26px;
  width: 1.5px;
}

.relic-output-why-tree-children > .relic-output-why-tree-item {
  position: relative;
}

.relic-output-why-tree-children > .relic-output-why-tree-item::before {
  background: #80786c;
  content: "";
  height: 18px;
  left: 50%;
  position: absolute;
  top: -18px;
  width: 1.5px;
}
`;
