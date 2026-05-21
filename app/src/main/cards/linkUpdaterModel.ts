import { resolveWikiLinkPath } from "../../shared/links";

export function replaceCardLinks(
  content: string,
  sourcePath: string,
  oldRelativePath: string,
  oldBaseName: string,
  newBaseName: string,
  newPathWithoutExt: string
): string {
  const maskedContent = maskFencedCodeBlocks(content);
  let result = content;
  let offset = 0;

  const pattern = /(!)?\[\[([^\]\n]+)\]\]/g;

  for (const match of maskedContent.matchAll(pattern)) {
    const rawLink = match[0];
    const body = match[2];

    const parsed = parseWikiLinkBody(body);
    if (!parsed) continue;

    const resolvedPath = resolveWikiLinkPath(parsed.targetBase, sourcePath);
    if (resolvedPath !== oldRelativePath) continue;

    const isPathBased = parsed.rawTargetBase.includes("/");
    const newTargetBase = isPathBased ? newPathWithoutExt : newBaseName;

    let newBody = newTargetBase;
    if (parsed.heading) newBody += `#${parsed.heading}`;
    if (parsed.blockId) newBody += `^${parsed.blockId}`;
    if (parsed.alias !== null) newBody += `|${parsed.alias}`;

    const embed = match[1] === "!" ? "!" : "";
    const newRawLink = `${embed}[[${newBody}]]`;

    const matchStart = match.index! + offset;
    result = result.slice(0, matchStart) + newRawLink + result.slice(matchStart + rawLink.length);
    offset += newRawLink.length - rawLink.length;
  }

  return result;
}

export function replaceCardFolderLinks(
  content: string,
  oldCardFolderRelativePath: string,
  newCardFolderRelativePath: string
): string {
  const maskedContent = maskFencedCodeBlocks(content);
  let result = content;
  let offset = 0;

  const oldPrefix = oldCardFolderRelativePath + "/";
  const newPrefix = newCardFolderRelativePath + "/";
  const pattern = /(!)?\[\[([^\]\n]+)\]\]/g;

  for (const match of maskedContent.matchAll(pattern)) {
    const rawLink = match[0];
    const body = match[2];

    const parsed = parseWikiLinkBody(body);
    if (!parsed) continue;

    const rawTargetWithExt = parsed.rawTargetBase.endsWith(".md")
      ? parsed.rawTargetBase
      : `${parsed.rawTargetBase}.md`;

    if (!rawTargetWithExt.includes("/")) continue;
    if (!rawTargetWithExt.startsWith(oldPrefix)) continue;

    const suffix = rawTargetWithExt.slice(oldPrefix.length).replace(/\.md$/, "");
    const newTargetBase = `${newPrefix}${suffix}`;

    let newBody = newTargetBase;
    if (parsed.heading) newBody += `#${parsed.heading}`;
    if (parsed.blockId) newBody += `^${parsed.blockId}`;
    if (parsed.alias !== null) newBody += `|${parsed.alias}`;

    const embed = match[1] === "!" ? "!" : "";
    const newRawLink = `${embed}[[${newBody}]]`;

    const matchStart = match.index! + offset;
    result = result.slice(0, matchStart) + newRawLink + result.slice(matchStart + rawLink.length);
    offset += newRawLink.length - rawLink.length;
  }

  return result;
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

  const blockParts = targetPart.split("^", 2);
  const headingParts = blockParts[0].split("#", 2);
  const rawTargetBase = headingParts[0].trim();

  if (!rawTargetBase) return null;

  const targetBase = rawTargetBase.endsWith(".md") ? rawTargetBase : `${rawTargetBase}.md`;

  return {
    alias,
    blockId: blockParts[1]?.trim() || null,
    heading: headingParts[1]?.trim() || null,
    rawTargetBase,
    targetBase
  };
}

function maskFencedCodeBlocks(markdown: string): string {
  return markdown.replace(/^```[\s\S]*?^```/gm, (block) => " ".repeat(block.length));
}
