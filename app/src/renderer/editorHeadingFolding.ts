import { foldGutter, foldService } from "@codemirror/language";
import type { Extension, EditorState } from "@codemirror/state";

import type { Translator } from "./i18nModel";
import { isClosingBacktickFence, parseBacktickOpeningFence } from "./markdownCodeFence";

const headingPattern = /^(#{1,6})\s+\S.*$/;

function headingLevel(lineText: string): number | null {
  const match = headingPattern.exec(lineText);

  return match ? match[1].length : null;
}

function isInsideBacktickFence(state: EditorState, lineNumber: number): boolean {
  let activeFence: { markerLength: number } | null = null;

  for (let currentLineNumber = 1; currentLineNumber < lineNumber; currentLineNumber += 1) {
    const lineText = state.doc.line(currentLineNumber).text;

    if (activeFence) {
      if (isClosingBacktickFence(lineText, activeFence.markerLength)) activeFence = null;
      continue;
    }

    const openingFence = parseBacktickOpeningFence(lineText);
    if (openingFence) activeFence = { markerLength: openingFence.markerLength };
  }

  return activeFence !== null;
}

export function headingFoldRange(state: EditorState, lineStart: number): { from: number; to: number } | null {
  const doc = state.doc;
  const headingLine = doc.lineAt(lineStart);
  const level = headingLevel(headingLine.text);

  if (level === null || isInsideBacktickFence(state, headingLine.number)) return null;

  let activeFence: { markerLength: number } | null = null;
  let sectionEndLineNumber = headingLine.number;

  for (let lineNumber = headingLine.number + 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber);

    if (activeFence) {
      if (isClosingBacktickFence(line.text, activeFence.markerLength)) activeFence = null;
      sectionEndLineNumber = lineNumber;
      continue;
    }

    const nextHeadingLevel = headingLevel(line.text);
    if (nextHeadingLevel !== null && nextHeadingLevel <= level) break;

    const openingFence = parseBacktickOpeningFence(line.text);
    if (openingFence) activeFence = { markerLength: openingFence.markerLength };

    sectionEndLineNumber = lineNumber;
  }

  if (sectionEndLineNumber <= headingLine.number) return null;

  const from = headingLine.to;
  const to = doc.line(sectionEndLineNumber).to;

  return from < to ? { from, to } : null;
}

export function createHeadingFoldingExtension(t: Translator): Extension {
  return [
    foldService.of((state, lineStart) => headingFoldRange(state, lineStart)),
    foldGutter({
      markerDOM: (open) => {
        const marker = document.createElement("span");
        marker.className = `cm-heading-fold-marker${open ? " cm-heading-fold-marker--open" : " cm-heading-fold-marker--closed"}`;
        marker.textContent = open ? "▾" : "▸";
        marker.setAttribute("aria-label", open ? t("editor.foldHeading") : t("editor.unfoldHeading"));
        marker.setAttribute("role", "button");
        marker.title = open ? t("editor.foldHeading") : t("editor.unfoldHeading");

        return marker;
      }
    })
  ];
}
