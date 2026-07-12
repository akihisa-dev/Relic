import type { EditorState } from "@codemirror/state";

import { isClosingCodeFence, parseCodeFenceOpening, type CodeFenceMarker } from "./markdownCodeFence";

interface FencedCodeBlockRange {
  from: number;
  to: number;
}

export function isPositionInFencedCodeBlock(state: EditorState, position: number): boolean {
  // This path runs while completion is being requested, so stop at the cursor
  // instead of scanning the rest of a large document on every keystroke.
  const targetPosition = Math.min(Math.max(0, position), state.doc.length);
  const targetLineNumber = state.doc.lineAt(targetPosition).number;
  let active: CodeFenceMarker | null = null;

  for (let lineNumber = 1; lineNumber <= targetLineNumber; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const marker = parseCodeFenceOpening(line.text);

    if (!active) {
      if (marker) active = marker;
      continue;
    }

    if (marker && isClosingCodeFence(line.text, active)) {
      if (lineNumber === targetLineNumber) return true;
      active = null;
    }
  }

  return active !== null;
}

export function rangeIntersectsFencedCodeBlock(state: EditorState, from: number, to: number): boolean {
  const rangeFrom = Math.min(from, to);
  const rangeTo = Math.max(from, to);

  return fencedCodeBlockRanges(state).some((range) => rangeFrom <= range.to && rangeTo >= range.from);
}

function fencedCodeBlockRanges(state: EditorState): FencedCodeBlockRange[] {
  const ranges: FencedCodeBlockRange[] = [];
  let active: { from: number; marker: CodeFenceMarker } | null = null;

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const marker = parseCodeFenceOpening(line.text);

    if (!active) {
      if (marker) active = { from: line.from, marker };
      continue;
    }

    if (marker && isClosingCodeFence(line.text, active.marker)) {
      ranges.push({ from: active.from, to: line.to });
      active = null;
    }
  }

  if (active) ranges.push({ from: active.from, to: state.doc.length });

  return ranges;
}
