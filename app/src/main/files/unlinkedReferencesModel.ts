import path from "node:path";

import type { UnlinkedReference } from "../../shared/ipc";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import { formatWikiLink } from "../../shared/links";

interface CollectUnlinkedReferencesOptions {
  existingMarkdownPaths: string[];
  sourcePath: string;
  targetBasenameCount?: number;
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
  const linkText = linkTextForSource(
    options.sourcePath,
    options.targetPath,
    options.existingMarkdownPaths,
    options.targetBasenameCount
  );
  const lines = content.match(/[^\n]*(?:\n|$)/g) ?? [];
  let offset = 0;
  let excludedRangeIndex = 0;

  for (const [lineIndex, rawLine] of lines.entries()) {
    const line = rawLine.endsWith("\n") ? rawLine.slice(0, -1) : rawLine;
    let lineMatchIndex = line.indexOf(matchText);

    while (lineMatchIndex >= 0) {
      const from = offset + lineMatchIndex;
      const to = from + matchText.length;

      while (excludedRangeIndex < excludedRanges.length && excludedRanges[excludedRangeIndex]!.to <= from) {
        excludedRangeIndex += 1;
      }

      if (!isRangeInRangesAtIndex(from, to, excludedRanges, excludedRangeIndex)) {
        references.push({
          from,
          lineNumber: lineIndex + 1,
          lineText: line.trim() === "" ? "(空行)" : line.trim(),
          linkText,
          matchText,
          sourceName: stripMarkdownExtension(path.posix.basename(options.sourcePath)),
          sourcePath: options.sourcePath,
          targetPath: options.targetPath,
          to
        });
      }

      lineMatchIndex = line.indexOf(matchText, lineMatchIndex + matchText.length);
    }

    offset += rawLine.length;
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
  existingMarkdownPaths: string[],
  targetBasenameCount?: number
): string {
  const targetName = stripMarkdownExtension(path.posix.basename(targetPath));
  const targetPathWithoutExtension = stripMarkdownExtension(targetPath);
  const basenameLinkResolvesToTarget = canBasenameLinkResolveToTarget(
    sourcePath,
    targetPath,
    existingMarkdownPaths,
    targetBasenameCount
  );

  return formatWikiLink("link", {
    alias: targetPathWithoutExtension === targetName ||
      basenameLinkResolvesToTarget
      ? null
      : targetName,
    targetBase: basenameLinkResolvesToTarget
      ? targetName
      : targetPathWithoutExtension
  });
}

function canBasenameLinkResolveToTarget(
  sourcePath: string,
  targetPath: string,
  existingMarkdownPaths: string[],
  targetBasenameCount?: number
): boolean {
  const targetBasename = path.posix.basename(targetPath);
  const sourceDirectory = sourcePath.includes("/")
    ? sourcePath.split("/").slice(0, -1).join("/")
    : "";
  const sameFolderTarget = sourceDirectory === "" ? targetBasename : `${sourceDirectory}/${targetBasename}`;

  if (sameFolderTarget === targetPath) return true;

  return (targetBasenameCount ?? existingMarkdownPaths.filter((candidate) => path.posix.basename(candidate) === targetBasename).length) === 1;
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

function isRangeInRangesAtIndex(
  from: number,
  to: number,
  ranges: Array<{ from: number; to: number }>,
  rangeIndex: number
): boolean {
  const range = ranges[rangeIndex];

  return range !== undefined && from < range.to && to > range.from;
}

function isSafeWikiLinkPart(value: string): boolean {
  return value.trim() === value &&
    value !== "" &&
    !value.includes("\n") &&
    !value.includes("]") &&
    !value.includes("|");
}
