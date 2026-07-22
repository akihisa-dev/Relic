import type { Text } from "@codemirror/state";

export interface EditorTextRange {
  from: number;
  to: number;
}

const complexVisibleScore = 120;

export function markdownComplexityScore(doc: Text, ranges: readonly EditorTextRange[]): number {
  let score = Math.min(doc.length, 300_000) / 10_000;

  for (const range of ranges) {
    const from = Math.max(0, Math.min(range.from, doc.length));
    const to = Math.max(from, Math.min(range.to, doc.length));
    const text = doc.sliceString(from, Math.min(to, from + 50_000));
    score += text.length / 500;
    score += (text.match(/^(?:\s*(?:```|~~~|\$\$|\|)|\s*>?\s*(?:[-+*]|\d+\.)\s+)/gm)?.length ?? 0) * 6;
    score += (text.match(/(?:\$[^\n$]+\$|\[\[|!\[|\*\*|==)/g)?.length ?? 0) * 2;
  }

  return score;
}

export function editorHeavyUpdateDelay(doc: Text, ranges: readonly EditorTextRange[]): number {
  return markdownComplexityScore(doc, ranges) >= complexVisibleScore ? 90 : 0;
}

export function diagramRenderDelay(source: string): number {
  const structuralLines = source.match(/^(?:\s*(?:subgraph|classDiagram|sequenceDiagram|stateDiagram|graph|flowchart)|.*(?:-->|->|:))/gm)?.length ?? 0;
  return source.length >= 600 || structuralLines >= 20 ? 100 : 0;
}
