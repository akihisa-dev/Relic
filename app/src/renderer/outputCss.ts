export const outputCss = `
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

.relic-output-diagram-canvas {
  background: transparent;
  box-sizing: border-box;
  display: block;
  height: auto;
  max-height: 235mm;
  max-width: 100%;
  width: 100%;
}

.relic-output-diagram-canvas-line {
  fill: none;
  stroke: #4c4a45;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.5;
}

.relic-output-diagram-canvas-arrow {
  fill: #4c4a45;
}

.relic-output-diagram-canvas-label {
  fill: #272521;
  font-size: 14px;
  paint-order: stroke;
  stroke: #ffffff;
  stroke-linejoin: round;
  stroke-width: 5px;
  text-anchor: middle;
}

.relic-output-diagram-canvas-node {
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

.relic-output-diagram-canvas-node > span {
  position: relative;
  z-index: 1;
}

.relic-output-diagram-canvas-node-label {
  align-items: center;
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

.relic-output-diagram-canvas-node-label--shape-decision {
  padding: 18px 34px;
}

.relic-output-diagram-canvas-node-label--shape-input-output {
  padding-left: 28px;
  padding-right: 28px;
}

.relic-output-diagram-canvas-node-label--area {
  align-items: flex-start;
  color: #4f4940;
  font-size: 13px;
  justify-content: flex-start;
  padding: 12px 14px;
  text-align: left;
}

.relic-output-diagram-canvas-node--shape-terminator {
  border-radius: 999px;
}

.relic-output-diagram-canvas-node--shape-decision {
  background: transparent;
  border: 0;
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  padding: 18px 34px;
  position: relative;
}

.relic-output-diagram-canvas-node--shape-decision::before,
.relic-output-diagram-canvas-node--shape-decision::after {
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  content: "";
  pointer-events: none;
  position: absolute;
}

.relic-output-diagram-canvas-node--shape-decision::before {
  background: #80786c;
  inset: 0;
}

.relic-output-diagram-canvas-node--shape-decision::after {
  background: #ffffff;
  inset: 1.5px;
}

.relic-output-diagram-canvas-node--shape-input-output {
  clip-path: polygon(14% 0, 100% 0, 86% 100%, 0 100%);
  padding-left: 28px;
  padding-right: 28px;
}

.relic-output-diagram-canvas-node--shape-area {
  align-items: flex-start;
  background: rgba(0, 124, 175, 0.14);
  border: 1.5px dashed #80786c;
  box-shadow: none;
  color: #4f4940;
  justify-content: flex-start;
  padding: 12px 14px;
  text-align: left;
}

`;
