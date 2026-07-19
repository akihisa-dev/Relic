export interface MarkdownCodeFenceMarker {
  char: "`" | "~";
  length: number;
}

export function parseMarkdownCodeFenceOpening(lineText: string): MarkdownCodeFenceMarker | null {
  const match = /^ {0,3}(`{3,}|~{3,})/.exec(lineText);
  if (!match) return null;
  const marker = match[1];
  return { char: marker[0] as "`" | "~", length: marker.length };
}

export function isMarkdownCodeFenceClosing(
  lineText: string,
  opening: MarkdownCodeFenceMarker
): boolean {
  const match = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(lineText);
  if (!match) return false;
  const marker = match[1];
  return marker[0] === opening.char && marker.length >= opening.length;
}
