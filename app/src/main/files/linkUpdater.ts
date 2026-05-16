import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveWikiLinkPath } from "../../shared/links";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveWorkspaceRelativePath } from "./paths";

/**
 * ファイルリネーム後、ワークスペース内の内部リンクを一括更新する。
 * - basename-only リンク（[[ファイル名]]）：同じフォルダ内のファイルからのリンクを更新
 * - パス付きリンク（[[フォルダ/ファイル名]]）：任意のファイルからのリンクを更新
 */
export async function updateLinksForFileRename(
  workspacePath: string,
  oldRelativePath: string,
  newRelativePath: string
): Promise<void> {
  if (oldRelativePath === newRelativePath) return;

  const fileTree = await readWorkspaceFileTree(workspacePath);
  const markdownPaths = collectMarkdownPaths(fileTree);

  const oldBaseName = path.basename(oldRelativePath, ".md");
  const newBaseName = path.basename(newRelativePath, ".md");
  const newPathWithoutExt = newRelativePath.replace(/\.md$/, "");

  for (const sourcePath of markdownPaths) {
    const absoluteSourcePath = resolveWorkspaceRelativePath(workspacePath, sourcePath);
    if (!absoluteSourcePath.ok) continue;

    let content: string;
    try {
      content = await readFile(absoluteSourcePath.value, "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        console.error(`[linkUpdater] readFile failed: ${absoluteSourcePath.value}`, err);
      }
      continue;
    }

    const updatedContent = replaceFileLinks(
      content,
      sourcePath,
      oldRelativePath,
      oldBaseName,
      newBaseName,
      newPathWithoutExt
    );

    if (updatedContent !== content) {
      try {
        await writeFile(absoluteSourcePath.value, updatedContent, "utf8");
      } catch (err) {
        console.error(`[linkUpdater] writeFile failed: ${absoluteSourcePath.value}`, err);
      }
    }
  }
}

/**
 * フォルダリネーム後、パス付き内部リンクを一括更新する。
 * basename-only リンクはフォルダ内ファイル同士の相対関係が保たれるため更新不要。
 */
export async function updateLinksForFolderRename(
  workspacePath: string,
  oldFolderRelativePath: string,
  newFolderRelativePath: string
): Promise<void> {
  if (oldFolderRelativePath === newFolderRelativePath) return;

  const fileTree = await readWorkspaceFileTree(workspacePath);
  const markdownPaths = collectMarkdownPaths(fileTree);

  for (const sourcePath of markdownPaths) {
    const absoluteSourcePath = resolveWorkspaceRelativePath(workspacePath, sourcePath);
    if (!absoluteSourcePath.ok) continue;

    let content: string;
    try {
      content = await readFile(absoluteSourcePath.value, "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        console.error(`[linkUpdater] readFile failed: ${absoluteSourcePath.value}`, err);
      }
      continue;
    }

    const updatedContent = replaceFolderLinks(
      content,
      oldFolderRelativePath,
      newFolderRelativePath
    );

    if (updatedContent !== content) {
      try {
        await writeFile(absoluteSourcePath.value, updatedContent, "utf8");
      } catch (err) {
        console.error(`[linkUpdater] writeFile failed: ${absoluteSourcePath.value}`, err);
      }
    }
  }
}

function replaceFileLinks(
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

function replaceFolderLinks(
  content: string,
  oldFolderRelativePath: string,
  newFolderRelativePath: string
): string {
  const maskedContent = maskFencedCodeBlocks(content);
  let result = content;
  let offset = 0;

  const oldPrefix = oldFolderRelativePath + "/";
  const newPrefix = newFolderRelativePath + "/";
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
