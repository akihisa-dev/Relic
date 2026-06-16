import { resolveWikiLinkPath } from "../../shared/links";
import { ensureMarkdownExtension, stripMarkdownExtension } from "../../shared/markdownExtension";

export function replaceFileLinks(
  content: string,
  sourcePath: string,
  oldRelativePath: string,
  newBaseName: string,
  newPathWithoutExt: string
): string {
  return replaceFileLinksWithCount(
    content,
    sourcePath,
    oldRelativePath,
    newBaseName,
    newPathWithoutExt
  ).content;
}

export function replaceFileLinksWithCount(
  content: string,
  sourcePath: string,
  oldRelativePath: string,
  newBaseName: string,
  newPathWithoutExt: string
): { content: string; count: number } {
  const maskedContent = maskMarkdownCodeRanges(content);
  let result = content;
  let offset = 0;
  let count = 0;

  const pattern = /(!)?\[\[([^\]\n]+)\]\]/g;

  for (const match of maskedContent.matchAll(pattern)) {
    const matchStart = match.index;
    const rawLink = match[0] ?? "";
    const body = match[2] ?? "";

    if (matchStart === undefined || !rawLink) continue;
    const parsed = parseWikiLinkBody(body);
    if (!parsed) continue;

    const resolvedPath = resolveWikiLinkPath(parsed.targetBase, sourcePath);
    if (resolvedPath !== oldRelativePath) continue;

    const isPathBased = /\//.test(parsed.rawTargetBase);
    const newRelativePath = `${newPathWithoutExt}.md`;
    const canKeepBaseNameOnly = resolveWikiLinkPath(newBaseName, sourcePath) === newRelativePath;
    const newTargetBase = isPathBased || !canKeepBaseNameOnly ? newPathWithoutExt : newBaseName;

    let newBody = newTargetBase;
    if (parsed.heading) newBody += `#${parsed.heading}`;
    if (parsed.blockId) newBody += `^${parsed.blockId}`;
    if (parsed.alias !== null) newBody += `|${parsed.alias}`;

    const embed = match[1] === "!" ? "!" : "";
    const newRawLink = `${embed}[[${newBody}]]`;

    const adjustedMatchStart = matchStart + offset;
    result = result.slice(0, adjustedMatchStart) + newRawLink + result.slice(adjustedMatchStart + rawLink.length);
    offset += newRawLink.length - rawLink.length;
    count += 1;
  }

  return { content: result, count };
}

export function replaceFolderLinks(
  content: string,
  oldFolderRelativePath: string,
  newFolderRelativePath: string
): string {
  return replaceFolderLinksWithCount(content, oldFolderRelativePath, newFolderRelativePath).content;
}

export function replaceFolderLinksWithCount(
  content: string,
  oldFolderRelativePath: string,
  newFolderRelativePath: string
): { content: string; count: number } {
  const maskedContent = maskMarkdownCodeRanges(content);
  let result = content;
  let offset = 0;
  let count = 0;

  const oldPrefix = oldFolderRelativePath + "/";
  const newPrefix = newFolderRelativePath + "/";
  const pattern = /(!)?\[\[([^\]\n]+)\]\]/g;

  for (const match of maskedContent.matchAll(pattern)) {
    const matchStart = match.index;
    const rawLink = match[0] ?? "";
    const body = match[2] ?? "";

    if (matchStart === undefined || !rawLink) continue;
    const parsed = parseWikiLinkBody(body);
    if (!parsed) continue;

    const rawTargetWithExt = ensureMarkdownExtension(parsed.rawTargetBase);

    if (!/\//.test(rawTargetWithExt)) continue;
    if (!rawTargetWithExt.startsWith(oldPrefix)) continue;

    const suffix = stripMarkdownExtension(rawTargetWithExt.slice(oldPrefix.length));
    const newTargetBase = `${newPrefix}${suffix}`;

    let newBody = newTargetBase;
    if (parsed.heading) newBody += `#${parsed.heading}`;
    if (parsed.blockId) newBody += `^${parsed.blockId}`;
    if (parsed.alias !== null) newBody += `|${parsed.alias}`;

    const embed = match[1] === "!" ? "!" : "";
    const newRawLink = `${embed}[[${newBody}]]`;

    const adjustedMatchStart = matchStart + offset;
    result = result.slice(0, adjustedMatchStart) + newRawLink + result.slice(adjustedMatchStart + rawLink.length);
    offset += newRawLink.length - rawLink.length;
    count += 1;
  }

  return { content: result, count };
}

interface ParsedWikiLinkBody {
  alias: string | null;
  blockId: string | null;
  heading: string | null;
  rawTargetBase: string;
  targetBase: string;
}

function parseWikiLinkBody(body: string): ParsedWikiLinkBody | null {
  const pipeIndex = body.indexOf("|");
  const targetPart = pipeIndex >= 0 ? body.slice(0, pipeIndex) : body;
  const alias = pipeIndex >= 0 ? body.slice(pipeIndex + 1) : null;

  const [targetWithHeading = "", blockId] = targetPart.split("^", 2);
  const [targetBasePart = "", heading] = targetWithHeading.split("#", 2);
  const rawTargetBase = targetBasePart.trim();

  if (!rawTargetBase) return null;

  const targetBase = ensureMarkdownExtension(rawTargetBase);

  return {
    alias,
    blockId: blockId?.trim() || null,
    heading: heading?.trim() || null,
    rawTargetBase,
    targetBase
  };
}

function maskMarkdownCodeRanges(markdown: string): string {
  const lines = markdown.match(/[^\n]*(?:\n|$)/g) ?? [];
  let fence: { marker: "`" | "~"; length: number } | null = null;

  return lines.map((line) => {
    if (line === "") return line;

    if (fence) {
      const closesFence = new RegExp(`^ {0,3}\\${fence.marker}{${fence.length},}`).test(line);
      if (closesFence) {
        fence = null;
      }

      return maskText(line);
    }

    const fenceStart = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceStart) {
      const markerRun = fenceStart[1];
      fence = {
        length: markerRun.length,
        marker: markerRun[0] as "`" | "~"
      };

      return maskText(line);
    }

    if (/^(?: {4}|\t)/.test(line)) {
      return maskText(line);
    }

    return maskInlineCodeSpans(line);
  }).join("");
}

function maskInlineCodeSpans(line: string): string {
  let output = "";
  let cursor = 0;

  while (cursor < line.length) {
    const start = line.indexOf("`", cursor);
    if (start < 0) {
      output += line.slice(cursor);
      break;
    }

    let markerLength = 1;
    while (line[start + markerLength] === "`") {
      markerLength += 1;
    }

    const marker = "`".repeat(markerLength);
    const end = line.indexOf(marker, start + markerLength);
    if (end < 0) {
      output += line.slice(cursor);
      break;
    }

    output += line.slice(cursor, start);
    output += maskText(line.slice(start, end + markerLength));
    cursor = end + markerLength;
  }

  return output;
}

function maskText(value: string): string {
  return " ".repeat(value.length);
}
