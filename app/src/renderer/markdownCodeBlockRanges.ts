import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode, Tree } from "@lezer/common";

import { isClosingCodeFence, parseCodeFenceOpening, type CodeFenceMarker } from "./markdownCodeFence";

let visitedCodeFenceNodes = 0;

export function isPositionInFencedCodeBlock(state: EditorState, position: number): boolean {
  const targetPosition = Math.min(Math.max(0, position), state.doc.length);
  const tree = indexedSyntaxTree(state, targetPosition);
  if (tree.length < targetPosition) return scanFenceStateToPosition(state, targetPosition);
  return hasFencedCodeAncestor(tree.resolveInner(targetPosition, -1)) ||
    hasFencedCodeAncestor(tree.resolveInner(targetPosition, 1));
}

export function rangeIntersectsFencedCodeBlock(state: EditorState, from: number, to: number): boolean {
  const rangeFrom = Math.min(from, to);
  const rangeTo = Math.max(from, to);
  const tree = indexedSyntaxTree(state, rangeTo);

  if (tree.length < rangeTo) return scanFenceIntersection(state, rangeFrom, rangeTo);

  if (isPositionInFencedCodeBlock(state, rangeFrom) || isPositionInFencedCodeBlock(state, rangeTo)) return true;

  let intersects = false;
  tree.iterate({
    enter: (node) => {
      visitedCodeFenceNodes += 1;
      if (node.name === "FencedCode") {
        intersects = true;
        return false;
      }
      return !intersects;
    },
    from: rangeFrom,
    to: rangeTo
  });
  return intersects;
}

function indexedSyntaxTree(state: EditorState, to: number): Tree {
  return ensureSyntaxTree(state, Math.min(state.doc.length, to + 1), 25) ?? syntaxTree(state);
}

function scanFenceStateToPosition(state: EditorState, position: number): boolean {
  const targetLineNumber = state.doc.lineAt(position).number;
  let active: CodeFenceMarker | null = null;

  for (let lineNumber = 1; lineNumber <= targetLineNumber; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const marker = parseCodeFenceOpening(line.text);
    if (!active) {
      if (marker) active = marker;
    } else if (marker && isClosingCodeFence(line.text, active)) {
      if (lineNumber === targetLineNumber) return true;
      active = null;
    }
  }

  return active !== null;
}

function scanFenceIntersection(state: EditorState, from: number, to: number): boolean {
  let activeFrom: number | null = null;
  let activeMarker: CodeFenceMarker | null = null;

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const marker = parseCodeFenceOpening(line.text);
    if (!activeMarker) {
      if (marker) {
        activeMarker = marker;
        activeFrom = line.from;
      }
      continue;
    }
    if (!marker || !isClosingCodeFence(line.text, activeMarker)) continue;
    if (activeFrom !== null && from <= line.to && to >= activeFrom) return true;
    activeMarker = null;
    activeFrom = null;
    if (line.from > to) return false;
  }

  return activeFrom !== null && to >= activeFrom;
}

function hasFencedCodeAncestor(node: SyntaxNode | null): boolean {
  let current = node;
  while (current) {
    visitedCodeFenceNodes += 1;
    if (current.name === "FencedCode") return true;
    current = current.parent;
  }
  return false;
}

/** @internal Test-only counter for deterministic syntax-index assertions. */
export function __getVisitedCodeFenceNodesForTests(): number {
  return visitedCodeFenceNodes;
}

/** @internal Test-only reset for deterministic syntax-index assertions. */
export function __resetVisitedCodeFenceNodesForTests(): void {
  visitedCodeFenceNodes = 0;
}
