import type { EditorState } from "@codemirror/state";

interface FencedCodeBlockRange {
  from: number;
  to: number;
}

interface FenceMarker {
  char: "`" | "~";
  length: number;
}

export function isPositionInFencedCodeBlock(state: EditorState, position: number): boolean {
  return fencedCodeBlockRanges(state).some((range) => position >= range.from && position <= range.to);
}

export function rangeIntersectsFencedCodeBlock(state: EditorState, from: number, to: number): boolean {
  const rangeFrom = Math.min(from, to);
  const rangeTo = Math.max(from, to);

  return fencedCodeBlockRanges(state).some((range) => rangeFrom <= range.to && rangeTo >= range.from);
}

function fencedCodeBlockRanges(state: EditorState): FencedCodeBlockRange[] {
  const ranges: FencedCodeBlockRange[] = [];
  let active: { from: number; marker: FenceMarker } | null = null;

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const marker = fenceMarker(line.text);

    if (!active) {
      if (marker) active = { from: line.from, marker };
      continue;
    }

    if (marker && marker.char === active.marker.char && marker.length >= active.marker.length) {
      ranges.push({ from: active.from, to: line.to });
      active = null;
    }
  }

  if (active) ranges.push({ from: active.from, to: state.doc.length });

  return ranges;
}

function fenceMarker(text: string): FenceMarker | null {
  const match = text.match(/^ {0,3}(`{3,}|~{3,})/);
  if (!match) return null;

  const marker = match[1];
  return {
    char: marker[0] as "`" | "~",
    length: marker.length
  };
}
