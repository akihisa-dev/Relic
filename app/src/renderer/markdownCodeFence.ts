export interface BacktickCodeFence {
  language: string | null;
  markerLength: number;
}

export function parseBacktickOpeningFence(lineText: string): BacktickCodeFence | null {
  const match = /^[ \t]*(`{3,})(?:[ \t]*([^`]*))?$/.exec(lineText);
  if (!match) return null;

  const language = match[2]?.trim().split(/\s+/, 1)[0] ?? null;
  return { language, markerLength: match[1].length };
}

export function isClosingBacktickFence(lineText: string, openingMarkerLength: number): boolean {
  const match = /^[ \t]*(`{3,})[ \t]*$/.exec(lineText);

  return Boolean(match && match[1].length >= openingMarkerLength);
}
