import { syntaxTree } from "@codemirror/language";
import type { EditorState, Text } from "@codemirror/state";

import { parseBacktickOpeningFence } from "./markdownCodeFence";

export interface SyntaxBlockRange {
  from: number;
  to: number;
}

export interface FencedCodeBlockRange extends SyntaxBlockRange {
  language: string | null;
}

interface BlockMathRange extends SyntaxBlockRange {
  source: string;
}

export function sortedUniqueRanges<T extends SyntaxBlockRange>(ranges: T[]): T[] {
  return Array.from(new Map(ranges.map((range) => [`${range.from}:${range.to}`, range])).values())
    .toSorted((a, b) => a.from - b.from || a.to - b.to);
}

function syntaxBlocksInVisibleRanges(
  state: EditorState,
  visibleRanges: readonly SyntaxBlockRange[],
  nodeName: "FencedCode" | "Table"
): SyntaxBlockRange[] {
  const ranges: SyntaxBlockRange[] = [];
  const tree = syntaxTree(state);

  for (const visibleRange of visibleRanges) {
    tree.iterate({
      from: visibleRange.from,
      to: visibleRange.to,
      enter: (node) => {
        if (node.name === nodeName) ranges.push({ from: node.from, to: node.to });
      }
    });
  }

  return sortedUniqueRanges(ranges);
}

export function fencedCodeBlocksInVisibleRanges(
  state: EditorState,
  visibleRanges: readonly SyntaxBlockRange[]
): FencedCodeBlockRange[] {
  return syntaxBlocksInVisibleRanges(state, visibleRanges, "FencedCode").map((range) => {
    const openingFence = parseBacktickOpeningFence(state.doc.lineAt(range.from).text);
    return { ...range, language: openingFence?.language ?? null };
  });
}

export function tableRangesInVisibleRanges(
  state: EditorState,
  visibleRanges: readonly SyntaxBlockRange[]
): SyntaxBlockRange[] {
  return syntaxBlocksInVisibleRanges(state, visibleRanges, "Table");
}

export function currentSyntaxBlock<T extends SyntaxBlockRange>(
  blocks: T[],
  index: number,
  lineFrom: number,
  lineTo: number
): T | null {
  const block = blocks[index] ?? null;
  return block !== null && lineFrom >= block.from && lineTo <= block.to ? block : null;
}

export function lineNumberAtBlockEnd(doc: Text, to: number): number {
  return doc.lineAt(Math.max(0, to - 1)).number;
}

export function blockSource(doc: Text, block: SyntaxBlockRange): string {
  const startLine = doc.lineAt(block.from).number;
  const endLine = lineNumberAtBlockEnd(doc, block.to);

  if (endLine <= startLine + 1) return "";

  return doc.sliceString(doc.line(startLine + 1).from, doc.line(endLine - 1).to);
}

export function codeBlockFenceRanges(doc: Text, block: SyntaxBlockRange): SyntaxBlockRange[] {
  const startLine = doc.lineAt(block.from);
  const endLine = doc.line(lineNumberAtBlockEnd(doc, block.to));

  if (startLine.number === endLine.number) return [{ from: block.from, to: block.to }];

  return [
    { from: block.from, to: startLine.to },
    { from: endLine.from, to: block.to }
  ];
}

export function normalizeVisibleRanges(doc: Text, ranges: readonly SyntaxBlockRange[]): SyntaxBlockRange[] {
  return ranges.map((range) => {
    const from = Math.min(Math.max(0, range.from), doc.length);
    const to = Math.min(Math.max(from, range.to), doc.length);
    return { from, to };
  });
}

function findClosingMathLine(doc: Text, startLineNumber: number): number | null {
  for (let currentLine = startLineNumber + 1; currentLine <= doc.lines; currentLine += 1) {
    if (doc.line(currentLine).text.trim() === "$$") return currentLine;
  }

  return null;
}

function blockMathSource(doc: Text, openingLineNumber: number, closingLineNumber: number, singleLineSource?: string): string {
  if (singleLineSource !== undefined) return singleLineSource.trim();
  if (closingLineNumber <= openingLineNumber + 1) return "";

  return doc.sliceString(doc.line(openingLineNumber + 1).from, doc.line(closingLineNumber - 1).to).trim();
}

export function blockMathRangesInVisibleRanges(
  state: EditorState,
  visibleRanges: readonly SyntaxBlockRange[]
): BlockMathRange[] {
  const ranges: BlockMathRange[] = [];
  const doc = state.doc;
  const codeBlocks = fencedCodeBlocksInVisibleRanges(state, visibleRanges);
  let codeBlockIndex = 0;

  for (const { from: visFrom, to: visTo } of visibleRanges) {
    let lineNumber = doc.lineAt(visFrom).number;

    while (lineNumber <= doc.lineAt(visTo).number) {
      const line = doc.line(lineNumber);
      while (codeBlockIndex < codeBlocks.length && codeBlocks[codeBlockIndex].to <= line.from) codeBlockIndex += 1;
      const codeBlock = currentSyntaxBlock(codeBlocks, codeBlockIndex, line.from, line.to);

      if (codeBlock) {
        lineNumber = lineNumberAtBlockEnd(doc, codeBlock.to) + 1;
        continue;
      }

      const singleLineMatch = /^\s*\$\$(.*?)\$\$\s*$/.exec(line.text);
      const startsBlockMath = singleLineMatch !== null || /^\s*\$\$/.test(line.text);
      if (!startsBlockMath) {
        lineNumber += 1;
        continue;
      }

      const closingLineNumber = singleLineMatch ? lineNumber : findClosingMathLine(doc, lineNumber);
      if (!closingLineNumber) {
        lineNumber += 1;
        continue;
      }

      const closingLine = doc.line(closingLineNumber);
      ranges.push({
        from: line.from,
        source: blockMathSource(doc, lineNumber, closingLineNumber, singleLineMatch?.[1]),
        to: closingLine.to
      });
      lineNumber = closingLineNumber + 1;
    }
  }

  return sortedUniqueRanges(ranges);
}
