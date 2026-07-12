export interface CodeFenceMarker {
  char: "`" | "~";
  length: number;
}

export interface BacktickCodeFence {
  language: string | null;
  markerLength: number;
}

export function parseCodeFenceOpening(lineText: string): CodeFenceMarker | null {
  const match = /^ {0,3}(`{3,}|~{3,})/.exec(lineText);
  if (!match) return null;

  const marker = match[1];
  return { char: marker[0] as "`" | "~", length: marker.length };
}

export function isClosingCodeFence(lineText: string, opening: CodeFenceMarker): boolean {
  const match = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(lineText);
  if (!match) return false;

  const marker = match[1];
  return marker[0] === opening.char && marker.length >= opening.length;
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
