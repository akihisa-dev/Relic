import {
  isMarkdownCodeFenceClosing,
  parseMarkdownCodeFenceOpening,
  type MarkdownCodeFenceMarker
} from "../shared/markdownCodeFence";

export type CodeFenceMarker = MarkdownCodeFenceMarker;

export interface BacktickCodeFence {
  language: string | null;
  markerLength: number;
}

export function parseCodeFenceOpening(lineText: string): CodeFenceMarker | null {
  return parseMarkdownCodeFenceOpening(lineText);
}

export function isClosingCodeFence(lineText: string, opening: CodeFenceMarker): boolean {
  return isMarkdownCodeFenceClosing(lineText, opening);
}

export function parseBacktickOpeningFence(lineText: string): BacktickCodeFence | null {
  const match = /^[ \t]*(`{3,})(?:[ \t]*([^`]*))?$/.exec(lineText);
  if (!match) return null;

  const language = match[2]?.trim().split(/\s+/, 1)[0] ?? null;
  const marker = match[1] ?? "";
  if (!marker) return null;

  return { language, markerLength: marker.length };
}

export function isClosingBacktickFence(lineText: string, openingMarkerLength: number): boolean {
  const match = /^[ \t]*(`{3,})[ \t]*$/.exec(lineText);

  return Boolean(match && (match[1] ?? "").length >= openingMarkerLength);
}
