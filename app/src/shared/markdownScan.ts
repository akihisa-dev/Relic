export interface MarkdownSourceRange {
  from: number;
  to: number;
}

export function collectMarkdownCodeRanges(markdown: string): MarkdownSourceRange[] {
  const ranges: MarkdownSourceRange[] = [];
  const lines = markdown.match(/[^\n]*(?:\n|$)/g) ?? [];
  let fence: MarkdownCodeFenceMarker | null = null;
  let offset = 0;

  for (const line of lines) {
    const lineStart = offset;
    const lineEnd = lineStart + line.length;
    offset = lineEnd;
    if (line === "") continue;

    if (fence) {
      if (isMarkdownCodeFenceClosing(line.trimEnd(), fence)) fence = null;
      ranges.push({ from: lineStart, to: lineEnd });
      continue;
    }

    const fenceStart = parseMarkdownCodeFenceOpening(line);
    if (fenceStart) {
      fence = fenceStart;
      ranges.push({ from: lineStart, to: lineEnd });
      continue;
    }

    if (/^(?: {4}|\t)/.test(line)) {
      ranges.push({ from: lineStart, to: lineEnd });
      continue;
    }

    ranges.push(...collectInlineCodeRanges(line, lineStart));
  }

  return ranges;
}

export function isMarkdownOffsetInRanges(offset: number, ranges: MarkdownSourceRange[]): boolean {
  for (const range of ranges) {
    if (offset < range.from) return false;
    if (offset >= range.from && offset < range.to) return true;
  }
  return false;
}

export function decodeMarkdownPath(value: string): string {
  try {
    return decodeURIComponent(value.trim()).replace(/\\/g, "/");
  } catch {
    return value.trim().replace(/\\/g, "/");
  }
}

export function normalizeMarkdownPathSegments(value: string): string {
  const output: string[] = [];
  for (const segment of value.replace(/\\/g, "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      output.pop();
      continue;
    }
    output.push(segment);
  }
  return output.join("/");
}

function collectInlineCodeRanges(line: string, lineStart: number): MarkdownSourceRange[] {
  const ranges: MarkdownSourceRange[] = [];
  let cursor = 0;
  while (cursor < line.length) {
    const start = line.indexOf("`", cursor);
    if (start < 0) break;

    let markerLength = 1;
    while (line[start + markerLength] === "`") markerLength += 1;
    const marker = "`".repeat(markerLength);
    const end = line.indexOf(marker, start + markerLength);
    if (end < 0) break;

    ranges.push({ from: lineStart + start, to: lineStart + end + markerLength });
    cursor = end + markerLength;
  }
  return ranges;
}
import {
  isMarkdownCodeFenceClosing,
  parseMarkdownCodeFenceOpening,
  type MarkdownCodeFenceMarker
} from "./markdownCodeFence";
