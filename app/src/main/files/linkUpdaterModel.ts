import path from "node:path";

import { formatWikiLink, resolveWikiLinkPath, scanWikiLinks } from "../../shared/links";
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
  let result = content;
  let offset = 0;
  let count = 0;

  for (const parsed of scanWikiLinks(content)) {
    const resolvedPath = resolveWikiLinkPath(parsed.targetBase, sourcePath);
    if (resolvedPath !== oldRelativePath) continue;

    const isPathBased = /\//.test(parsed.rawTargetBase);
    const newRelativePath = `${newPathWithoutExt}.md`;
    const canKeepBaseNameOnly = resolveWikiLinkPath(newBaseName, sourcePath) === newRelativePath;
    const newTargetBase = isPathBased || !canKeepBaseNameOnly ? newPathWithoutExt : newBaseName;

    const newRawLink = formatWikiLink(parsed.kind, {
      alias: parsed.alias,
      blockId: parsed.blockId,
      heading: parsed.heading,
      targetBase: newTargetBase
    });

    const adjustedMatchStart = parsed.from + offset;
    result = result.slice(0, adjustedMatchStart) + newRawLink + result.slice(adjustedMatchStart + parsed.raw.length);
    offset += newRawLink.length - parsed.raw.length;
    count += 1;
  }

  return { content: result, count };
}

export function replaceMovedSourceBasenameLinksWithCount(
  content: string,
  sourcePath: string,
  previousSourcePath: string
): { content: string; count: number } {
  let result = content;
  let offset = 0;
  let count = 0;

  for (const parsed of scanWikiLinks(content)) {
    if (parsed.targetBase.includes("/")) continue;

    const previousResolvedPath = resolveWikiLinkPath(parsed.targetBase, previousSourcePath);
    if (previousResolvedPath === previousSourcePath) continue;

    const nextResolvedPath = resolveWikiLinkPath(parsed.targetBase, sourcePath);
    if (previousResolvedPath === nextResolvedPath) continue;

    const relativeTarget = path.posix.relative(
      path.posix.dirname(sourcePath),
      stripMarkdownExtension(previousResolvedPath)
    );

    const newRawLink = formatWikiLink(parsed.kind, {
      alias: parsed.alias,
      blockId: parsed.blockId,
      heading: parsed.heading,
      targetBase: relativeTarget
    });

    const adjustedMatchStart = parsed.from + offset;
    result = result.slice(0, adjustedMatchStart) + newRawLink + result.slice(adjustedMatchStart + parsed.raw.length);
    offset += newRawLink.length - parsed.raw.length;
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
  let result = content;
  let offset = 0;
  let count = 0;

  const oldPrefix = oldFolderRelativePath + "/";
  const newPrefix = newFolderRelativePath + "/";

  for (const parsed of scanWikiLinks(content)) {
    const rawTargetWithExt = ensureMarkdownExtension(parsed.rawTargetBase);

    if (!/\//.test(rawTargetWithExt)) continue;
    if (!rawTargetWithExt.startsWith(oldPrefix)) continue;

    const suffix = stripMarkdownExtension(rawTargetWithExt.slice(oldPrefix.length));
    const newTargetBase = `${newPrefix}${suffix}`;

    const newRawLink = formatWikiLink(parsed.kind, {
      alias: parsed.alias,
      blockId: parsed.blockId,
      heading: parsed.heading,
      targetBase: newTargetBase
    });

    const adjustedMatchStart = parsed.from + offset;
    result = result.slice(0, adjustedMatchStart) + newRawLink + result.slice(adjustedMatchStart + parsed.raw.length);
    offset += newRawLink.length - parsed.raw.length;
    count += 1;
  }

  return { content: result, count };
}
