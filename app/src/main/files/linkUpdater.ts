import { readFile } from "node:fs/promises";
import path from "node:path";

import type { LinkUpdateImpact, LinkUpdateImpactKind } from "../../shared/ipc";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { atomicWriteTextFile } from "./atomicWrite";
import { errorDetails } from "./fileSystem";
import { readWorkspaceFileTree } from "./fileTree";
import {
  replaceFileLinksWithCount,
  replaceMovedSourceBasenameLinksWithCount,
  replaceFolderLinksWithCount
} from "./linkUpdaterModel";
import { resolveExistingWorkspacePath, toWorkspaceRelativePath } from "./paths";

interface LinkUpdatePatch {
  absolutePath: string;
  linkCount: number;
  nextContent: string;
  previousContent: string;
}

interface LinkUpdatePatchResult {
  patches: LinkUpdatePatch[];
  skippedUnreadableFileCount: number;
}

interface LinkUpdateReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

interface LinkUpdateWriteOperations extends LinkUpdateReadOperations {
  writeTextFile(filePath: string, content: string): Promise<void>;
}

const defaultLinkUpdateReadOperations: LinkUpdateReadOperations = {
  readFile
};

const defaultLinkUpdateWriteOperations: LinkUpdateWriteOperations = {
  readFile,
  writeTextFile: atomicWriteTextFile
};

export async function readLinkUpdateImpact(
  workspacePath: string,
  kind: LinkUpdateImpactKind,
  oldPath: string,
  newPath: string,
  operations: LinkUpdateReadOperations = defaultLinkUpdateReadOperations
): Promise<RelicResult<LinkUpdateImpact>> {
  const patches = await buildLinkUpdatePatches(workspacePath, kind, oldPath, newPath, {
    operations,
    skipUnreadableFiles: true
  });
  if (!patches.ok) return patches;

  return ok(summarizeLinkUpdatePatches(patches.value));
}

/**
 * ファイルリネーム後、ワークスペース内の内部リンクを一括更新する。
 * - basename-only リンク（[[ファイル名]]）：同じフォルダ内のファイルからのリンクを更新
 * - パス付きリンク（[[フォルダ/ファイル名]]）：任意のファイルからのリンクを更新
 */
export async function updateLinksForFileRename(
  workspacePath: string,
  oldRelativePath: string,
  newRelativePath: string,
  operations: LinkUpdateWriteOperations = defaultLinkUpdateWriteOperations
): Promise<RelicResult<void>> {
  if (oldRelativePath === newRelativePath) return ok(undefined);

  const patches = await buildLinkUpdatePatches(workspacePath, "file", oldRelativePath, newRelativePath, {
    operations,
    skipUnreadableFiles: false
  });
  if (!patches.ok) return patches;

  return applyLinkUpdatePatches(patches.value.patches, operations);
}

/**
 * フォルダリネーム後、パス付き内部リンクを一括更新する。
 * basename-only リンクはフォルダ内ファイル同士の相対関係が保たれるため更新不要。
 */
export async function updateLinksForFolderRename(
  workspacePath: string,
  oldFolderRelativePath: string,
  newFolderRelativePath: string,
  operations: LinkUpdateWriteOperations = defaultLinkUpdateWriteOperations
): Promise<RelicResult<void>> {
  if (oldFolderRelativePath === newFolderRelativePath) return ok(undefined);

  const patches = await buildLinkUpdatePatches(workspacePath, "folder", oldFolderRelativePath, newFolderRelativePath, {
    operations,
    skipUnreadableFiles: false
  });
  if (!patches.ok) return patches;

  return applyLinkUpdatePatches(patches.value.patches, operations);
}

async function buildLinkUpdatePatches(
  workspacePath: string,
  kind: LinkUpdateImpactKind,
  oldPath: string,
  newPath: string,
  options: {
    operations: LinkUpdateReadOperations;
    skipUnreadableFiles: boolean;
  }
): Promise<RelicResult<LinkUpdatePatchResult>> {
  if (oldPath === newPath) {
    return ok({ patches: [], skippedUnreadableFileCount: 0 });
  }

  const normalizedOldPath = toWorkspaceRelativePath(oldPath);
  const normalizedNewPath = toWorkspaceRelativePath(newPath);

  const fileTree = await readWorkspaceFileTree(workspacePath);
  const markdownPaths = collectMarkdownPaths(fileTree);
  const patches: LinkUpdatePatch[] = [];
  const newBaseName = stripMarkdownExtension(path.posix.basename(normalizedNewPath));
  const newPathWithoutExt = stripMarkdownExtension(normalizedNewPath);
  const oldBaseName = stripMarkdownExtension(path.posix.basename(normalizedOldPath));
  const oldPathWithoutExt = stripMarkdownExtension(normalizedOldPath);
  let skippedUnreadableFileCount = 0;

  for (const sourcePath of markdownPaths) {
    const absoluteSourcePath = await resolveExistingWorkspacePath(workspacePath, sourcePath);
    if (!absoluteSourcePath.ok) return absoluteSourcePath;

    let content: string;
    try {
      content = await options.operations.readFile(absoluteSourcePath.value, "utf8");
    } catch (err) {
      if (options.skipUnreadableFiles) {
        skippedUnreadableFileCount += 1;
        continue;
      }

      return fail("LINK_UPDATE_READ_FAILED", "内部リンク更新のためにファイルを読み込めませんでした。", errorDetails(err));
    }

    if (!shouldProcessMarkdownFile(
      sourcePath,
      normalizedNewPath,
      kind,
      content,
      normalizedOldPath,
      oldBaseName,
      oldPathWithoutExt
    )) {
      continue;
    }

    const replacement = kind === "file"
      ? replaceFileLinksWithCount(
        content,
        sourcePath,
        normalizedOldPath,
        newBaseName,
        newPathWithoutExt
      )
      : replaceFolderLinksWithCount(content, normalizedOldPath, normalizedNewPath);

    const movedSourceReplacement = kind === "file" && sourcePath === normalizedNewPath
      ? replaceMovedSourceBasenameLinksWithCount(
        replacement.content,
        sourcePath,
        normalizedOldPath
      )
      : { content: replacement.content, count: 0 };
    replacement.content = movedSourceReplacement.content;
    replacement.count += movedSourceReplacement.count;

    if (replacement.content !== content) {
      patches.push({
        absolutePath: absoluteSourcePath.value,
        linkCount: replacement.count,
        nextContent: replacement.content,
        previousContent: content
      });
    }
  }

  return ok({
    patches,
    skippedUnreadableFileCount
  });
}

function shouldProcessMarkdownFile(
  sourcePath: string,
  newRelativePath: string,
  kind: LinkUpdateImpactKind,
  content: string,
  oldRelativePath: string,
  oldBaseName: string,
  oldPathWithoutExt: string
): boolean {
  if (sourcePath === newRelativePath) return true;

  if (kind === "folder") {
    return contentLikelyContainsPathPrefix(content, oldRelativePath);
  }

  return hasLikelyWikiLinkTarget(content, oldRelativePath, oldBaseName, oldPathWithoutExt);
}

function contentLikelyContainsPathPrefix(
  content: string,
  pathPrefix: string
): boolean {
  if (content.includes(pathPrefix)) return true;

  return content.includes(`[[${pathPrefix}/`) ||
    content.includes(`[[${pathPrefix}\\`) ||
    content.includes(`[[${pathPrefix}#`) ||
    content.includes(`[[${pathPrefix}^`) ||
    content.includes(`[[${pathPrefix}|`) ||
    content.includes(`[[${pathPrefix} `);
}

function hasLikelyWikiLinkTarget(
  content: string,
  oldRelativePath: string,
  oldBaseName: string,
  oldPathWithoutExt: string
): boolean {
  return content.includes(oldRelativePath) ||
    hasLikelyWikiLinkTargetOf(content, oldBaseName) ||
    hasLikelyWikiLinkTargetOf(content, oldPathWithoutExt) ||
    hasLikelyWikiLinkTargetOf(content, oldRelativePath);
}

function hasLikelyWikiLinkTargetOf(content: string, target: string): boolean {
  return content.includes(`[[${target}]]`) ||
    content.includes(`[[${target}#`) ||
    content.includes(`[[${target}^`) ||
    content.includes(`[[${target}|`) ||
    content.includes(`[[${target} `);
}

function summarizeLinkUpdatePatches(result: LinkUpdatePatchResult): LinkUpdateImpact {
  return {
    fileCount: result.patches.length,
    linkCount: result.patches.reduce((sum, patch) => sum + patch.linkCount, 0),
    unreadableFileCount: result.skippedUnreadableFileCount
  };
}

async function applyLinkUpdatePatches(
  patches: LinkUpdatePatch[],
  operations: LinkUpdateWriteOperations
): Promise<RelicResult<void>> {
  const applied: LinkUpdatePatch[] = [];

  try {
    for (const patch of patches) {
      const currentContent = await operations.readFile(patch.absolutePath, "utf8");
      if (currentContent !== patch.previousContent) {
        await rollbackAppliedPatches(applied, operations);
        return fail("LINK_UPDATE_CONFLICT", "内部リンク更新対象のファイルが外部で変更されています。再読み込みしてから実行してください。");
      }

      await operations.writeTextFile(patch.absolutePath, patch.nextContent);
      applied.push(patch);
    }

    return ok(undefined);
  } catch (error) {
    await rollbackAppliedPatches(applied, operations);

    return fail("LINK_UPDATE_WRITE_FAILED", "内部リンクを更新できませんでした。", errorDetails(error));
  }
}

async function rollbackAppliedPatches(
  applied: LinkUpdatePatch[],
  operations: LinkUpdateWriteOperations
): Promise<void> {
  for (const patch of applied.toReversed()) {
    try {
      const currentContent = await operations.readFile(patch.absolutePath, "utf8");
      if (currentContent === patch.nextContent) {
        await operations.writeTextFile(patch.absolutePath, patch.previousContent);
      }
    } catch {
      // ロールバックはベストエフォート。外部変更の上書きだけは避ける。
    }
  }
}
