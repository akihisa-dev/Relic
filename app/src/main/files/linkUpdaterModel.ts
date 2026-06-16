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
  const maskedContent = maskFencedCodeBlocks(content);
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
  const maskedContent = maskFencedCodeBlocks(content);
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

function maskFencedCodeBlocks(markdown: string): string {
  return markdown.replace(/^```[\s\S]*?^```/gm, (block) => " ".repeat(block.length));
}
