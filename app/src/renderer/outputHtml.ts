import { diagramLanguageFor } from "./diagramLanguage";
import { renderDiagramElement } from "./diagramPreview";
import { decodeDiagramSourceAttribute } from "./diagramSourceAttribute";
import { getRenderedDiagramSvgText } from "./diagramSvg";
import { sanitizePreviewHtml, sanitizeSvgHtml } from "./htmlSanitizer";
import type { Translator } from "./i18nModel";
import { escapeHtml, renderMarkdown } from "./previewMarkdown";

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
  const documentTitle = title?.trim() || firstH1(content) || outputFileNameFromPath(path) || fileName || "Relic";
  const defaultFileName = safeOutputFileName(outputFileNameFromPath(path) || fileName || firstH1(content) || "relic-preview");
  const root = document.createElement("div");
  root.className = "relic-output-body";
  root.innerHTML = renderMarkdown(content, workspacePath, new Map(), false, t);
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

const outputCss = `
@page {
  margin: 16mm 15mm;
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
`;
