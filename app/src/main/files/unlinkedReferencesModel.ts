import path from "node:path";

import type { UnlinkedReference } from "../../shared/ipc";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import { formatWikiLink } from "../../shared/links";

interface CollectUnlinkedReferencesOptions {
  existingMarkdownPaths: string[];
  sourcePath: string;
  targetPath: string;
}

export function collectUnlinkedReferencesInMarkdown(
  content: string,
  options: CollectUnlinkedReferencesOptions
): UnlinkedReference[] {
  const matchText = stripMarkdownExtension(path.posix.basename(options.targetPath));
  if (matchText.trim() === "") return [];
  if (!isSafeWikiLinkPart(matchText) || !isSafeWikiLinkPart(stripMarkdownExtension(options.targetPath))) return [];
  if (!content.includes(matchText)) return [];

  const excludedRanges = [
    ...collectMarkdownCodeRanges(content),
    ...collectWikiLinkRanges(content),
    ...collectMarkdownLinkRanges(content)
  ].sort((a, b) => a.from - b.from);
  const references: UnlinkedReference[] = [];
  const linkText = linkTextForSource(options.sourcePath, options.targetPath, options.existingMarkdownPaths);
  let from = content.indexOf(matchText);

  while (from >= 0) {
    const to = from + matchText.length;
    if (!isRangeInRanges(from, to, excludedRanges)) {
      references.push({
        from,
        lineNumber: lineNumberAt(content, from),
        lineText: lineTextAt(content, from),
        linkText,
        matchText,
        sourceName: stripMarkdownExtension(path.posix.basename(options.sourcePath)),
        sourcePath: options.sourcePath,
        targetPath: options.targetPath,
        to
      });
    }

    from = content.indexOf(matchText, to);
  }

  return references;
}

export function applyUnlinkedReferenceToMarkdown(
  content: string,
  options: Pick<UnlinkedReference, "from" | "linkText" | "matchText" | "to">
): string | null {
  if (
    options.from < 0 ||
    options.to < options.from ||
    content.slice(options.from, options.to) !== options.matchText
  ) {
    return null;
  }

  const excludedRanges = [
    ...collectMarkdownCodeRanges(content),
    ...collectWikiLinkRanges(content),
    ...collectMarkdownLinkRanges(content)
  ];

  if (isRangeInRanges(options.from, options.to, excludedRanges)) {
    return null;
  }

  return `${content.slice(0, options.from)}${options.linkText}${content.slice(options.to)}`;
}

function linkTextForSource(
  sourcePath: string,
  targetPath: string,
  existingMarkdownPaths: string[]
): string {
  const targetName = stripMarkdownExtension(path.posix.basename(targetPath));
  const targetPathWithoutExtension = stripMarkdownExtension(targetPath);

  return formatWikiLink("link", {
    alias: targetPathWithoutExtension === targetName ||
      canBasenameLinkResolveToTarget(sourcePath, targetPath, existingMarkdownPaths)
      ? null
      : targetName,
    targetBase: canBasenameLinkResolveToTarget(sourcePath, targetPath, existingMarkdownPaths)
      ? targetName
      : targetPathWithoutExtension
  });
}

function canBasenameLinkResolveToTarget(
  sourcePath: string,
  targetPath: string,
  existingMarkdownPaths: string[]
): boolean {
  const targetBasename = path.posix.basename(targetPath);
  const sourceDirectory = sourcePath.includes("/")
    ? sourcePath.split("/").slice(0, -1).join("/")
    : "";
  const sameFolderTarget = sourceDirectory === "" ? targetBasename : `${sourceDirectory}/${targetBasename}`;

  if (sameFolderTarget === targetPath) return true;

  return existingMarkdownPaths.filter((candidate) => path.posix.basename(candidate) === targetBasename).length === 1;
}

function collectWikiLinkRanges(content: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  const pattern = /!?\[\[[^\]\n]+\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    ranges.push({ from: match.index, to: match.index + match[0].length });
  }

  return ranges;
}

function collectMarkdownLinkRanges(content: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  const pattern = /!?\[[^\]\n]*\]\([^\)\n]*\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    ranges.push({ from: match.index, to: match.index + match[0].length });
  }

  return ranges;
}

function collectMarkdownCodeRanges(markdown: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  const lines = markdown.match(/[^\n]*(?:\n|$)/g) ?? [];
  let fence: { marker: "`" | "~"; length: number } | null = null;
  let offset = 0;

  for (const line of lines) {
    const lineStart = offset;
    const lineEnd = lineStart + line.length;
    offset = lineEnd;

    if (line === "") continue;

    if (fence) {
      const closesFence = closesMarkdownFence(line, fence);
      ranges.push({ from: lineStart, to: lineEnd });
      if (closesFence) fence = null;
      continue;
    }

    const fenceStart = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceStart) {
      const markerRun = fenceStart[1] ?? "";
      fence = {
        length: markerRun.length,
        marker: markerRun[0] === "~" ? "~" : "`"
      };
      ranges.push({ from: lineStart, to: lineEnd });
    }
  }

  return ranges;
}

function closesMarkdownFence(line: string, fence: { marker: "`" | "~"; length: number }): boolean {
  let index = 0;

  while (index < line.length && line[index] === " ") {
    index += 1;
  }

  if (index > 3) return false;

  let markerLength = 0;
  while (line[index + markerLength] === fence.marker) {
    markerLength += 1;
  }

  return markerLength >= fence.length;
}

function isRangeInRanges(
  from: number,
  to: number,
  ranges: Array<{ from: number; to: number }>
): boolean {
  return ranges.some((range) => from < range.to && to > range.from);
}

function lineNumberAt(content: string, offset: number): number {
  let lineNumber = 1;

  for (let index = 0; index < offset; index += 1) {
    if (content[index] === "\n") lineNumber += 1;
  }

  return lineNumber;
}

function lineTextAt(content: string, offset: number): string {
  const lineStart = content.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const nextLineBreak = content.indexOf("\n", offset);
  const lineEnd = nextLineBreak >= 0 ? nextLineBreak : content.length;
  const line = content.slice(lineStart, lineEnd).trim();

  return line === "" ? "(空行)" : line;
}

function isSafeWikiLinkPart(value: string): boolean {
  return value.trim() === value &&
    value !== "" &&
    !value.includes("\n") &&
    !value.includes("]") &&
    !value.includes("|");
}
