import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { LinkUpdateImpact, LinkUpdateImpactKind } from "../../shared/ipc";
import { maxMarkdownReadBytes } from "../../shared/ipc/files";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicError, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { atomicWriteTextFile } from "./atomicWrite";
import { errorDetails } from "./fileSystem";
import { readWorkspaceFileTree } from "./fileTree";
import {
  assertMarkdownMutationSnapshotCurrent,
  captureMarkdownMutationSnapshot,
  isMarkdownMutationConflict,
  MarkdownMutationConflictError,
  runMarkdownFileMutation,
  type MarkdownMutationOperations,
  type MarkdownMutationSnapshot
} from "./markdownMutationCoordinator";
import {
  replaceFileLinksWithCount,
  replaceMovedSourceBasenameLinksWithCount,
  replaceFolderLinksWithCount
} from "./linkUpdaterModel";
import {
  resolveExistingWorkspacePath,
  resolveWorkspaceRelativePath,
  toWorkspaceRelativePath
} from "./paths";

interface LinkUpdatePatch {
  absolutePath: string;
  linkCount: number;
  nextContent: string;
  previousContent: string;
  relativePath: string;
}

interface LinkUpdatePatchResult {
  patches: LinkUpdatePatch[];
  skippedUnreadableFileCount: number;
}

interface LinkUpdateReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  stat?: MarkdownMutationOperations["stat"];
}

export interface LinkUpdateWriteOperations extends LinkUpdateReadOperations {
  stat?: MarkdownMutationOperations["stat"];
  writeTextFile(filePath: string, content: string): Promise<void>;
}

export interface LinkUpdateRecovery {
  appliedPaths: string[];
  conflictedPaths: string[];
  rolledBackPaths: string[];
  rollbackFailedPaths: string[];
}

export type LinkUpdateTransactionResult =
  | {
      ok: true;
      value: void;
    }
  | {
      error: RelicError;
      ok: false;
      recovery: LinkUpdateRecovery;
    };

export const maxLinkUpdateFiles = 50_000;
export const maxLinkUpdateReadBytes = maxMarkdownReadBytes;
export const maxLinkUpdateAggregateReadBytes = 64 * 1024 * 1024;

export interface PreparedLinkUpdate {
  apply(operations?: LinkUpdateWriteOperations): Promise<LinkUpdateTransactionResult>;
}

const defaultLinkUpdateReadOperations: LinkUpdateReadOperations = {
  readFile,
  stat
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
): Promise<LinkUpdateTransactionResult> {
  if (oldRelativePath === newRelativePath) return { ok: true, value: undefined };

  const patches = await buildLinkUpdatePatches(workspacePath, "file", oldRelativePath, newRelativePath, {
    operations,
    skipUnreadableFiles: false
  });
  if (!patches.ok) return withEmptyRecovery(patches.error);

  return applyLinkUpdatePatches(patches.value.patches, operations);
}

export async function prepareLinksForFileRename(
  workspacePath: string,
  oldRelativePath: string,
  newRelativePath: string,
  operations: LinkUpdateReadOperations = defaultLinkUpdateReadOperations
): Promise<RelicResult<PreparedLinkUpdate>> {
  if (oldRelativePath === newRelativePath) {
    return ok({
      apply: async () => ({ ok: true, value: undefined })
    });
  }

  const patches = await buildLinkUpdatePatches(workspacePath, "file", oldRelativePath, newRelativePath, {
    movedFile: {
      newRelativePath: toWorkspaceRelativePath(newRelativePath),
      oldRelativePath: toWorkspaceRelativePath(oldRelativePath)
    },
    operations,
    skipUnreadableFiles: false
  });
  if (!patches.ok) return patches;

  return ok({
    apply: async (writeOperations = defaultLinkUpdateWriteOperations) =>
      applyLinkUpdatePatches(patches.value.patches, writeOperations)
  });
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
): Promise<LinkUpdateTransactionResult> {
  if (oldFolderRelativePath === newFolderRelativePath) return { ok: true, value: undefined };

  const patches = await buildLinkUpdatePatches(workspacePath, "folder", oldFolderRelativePath, newFolderRelativePath, {
    operations,
    skipUnreadableFiles: false
  });
  if (!patches.ok) return withEmptyRecovery(patches.error);

  return applyLinkUpdatePatches(patches.value.patches, operations);
}

async function buildLinkUpdatePatches(
  workspacePath: string,
  kind: LinkUpdateImpactKind,
  oldPath: string,
  newPath: string,
  options: {
    movedFile?: {
      newRelativePath: string;
      oldRelativePath: string;
    };
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
  if (markdownPaths.length > maxLinkUpdateFiles) {
    return fail("LINK_UPDATE_READ_FAILED", "内部リンク更新の対象ファイル数が上限を超えています。");
  }
  const sourceFiles: Array<{ absolutePath: string; sourcePath: string }> = [];
  let skippedUnreadableFileCount = 0;
  let aggregateBytes = 0;
  for (const sourcePath of markdownPaths) {
    const absoluteSourcePath = await resolveExistingWorkspacePath(workspacePath, sourcePath);
    if (!absoluteSourcePath.ok) return absoluteSourcePath;

    let fileStats;
    try {
      fileStats = await (options.operations.stat ?? stat)(absoluteSourcePath.value);
    } catch (error) {
      if (options.skipUnreadableFiles) {
        skippedUnreadableFileCount += 1;
        continue;
      }
      return fail("LINK_UPDATE_READ_FAILED", "内部リンク更新のためにファイルを読み込めませんでした。", errorDetails(error));
    }
    if (!Number.isSafeInteger(fileStats.size) || fileStats.size < 0) {
      if (options.skipUnreadableFiles) {
        skippedUnreadableFileCount += 1;
        continue;
      }
      return fail("LINK_UPDATE_READ_FAILED", "内部リンク更新の対象ファイルを確認できませんでした。");
    }
    if (fileStats.size > maxLinkUpdateReadBytes) {
      return fail("LINK_UPDATE_READ_FAILED", "内部リンク更新の対象ファイルが大きすぎます。");
    }
    aggregateBytes += fileStats.size;
    if (aggregateBytes > maxLinkUpdateAggregateReadBytes) {
      return fail("LINK_UPDATE_READ_FAILED", "内部リンク更新の合計サイズが大きすぎます。");
    }
    sourceFiles.push({ absolutePath: absoluteSourcePath.value, sourcePath });
  }
  const patches: LinkUpdatePatch[] = [];
  const newBaseName = stripMarkdownExtension(path.posix.basename(normalizedNewPath));
  const newPathWithoutExt = stripMarkdownExtension(normalizedNewPath);
  const oldBaseName = stripMarkdownExtension(path.posix.basename(normalizedOldPath));
  const oldPathWithoutExt = stripMarkdownExtension(normalizedOldPath);
  let actualAggregateBytes = 0;
  for (const { absolutePath, sourcePath } of sourceFiles) {

    let content: string;
    try {
      content = await options.operations.readFile(absolutePath, "utf8");
    } catch (err) {
      if (options.skipUnreadableFiles) {
        skippedUnreadableFileCount += 1;
        continue;
      }

      return fail("LINK_UPDATE_READ_FAILED", "内部リンク更新のためにファイルを読み込めませんでした。", errorDetails(err));
    }

    const contentBytes = Buffer.byteLength(content, "utf8");
    if (contentBytes > maxLinkUpdateReadBytes) {
      return fail("LINK_UPDATE_READ_FAILED", "内部リンク更新の対象ファイルが大きすぎます。");
    }
    actualAggregateBytes += contentBytes;
    if (actualAggregateBytes > maxLinkUpdateAggregateReadBytes) {
      return fail("LINK_UPDATE_READ_FAILED", "内部リンク更新の合計サイズが大きすぎます。");
    }

    const effectiveSourcePath = options.movedFile?.oldRelativePath === sourcePath
      ? options.movedFile.newRelativePath
      : sourcePath;
    if (!shouldProcessMarkdownFile(
      effectiveSourcePath,
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
        effectiveSourcePath,
        normalizedOldPath,
        newBaseName,
        newPathWithoutExt
      )
      : replaceFolderLinksWithCount(content, normalizedOldPath, normalizedNewPath);

    const movedSourceReplacement = kind === "file" && effectiveSourcePath === normalizedNewPath
      ? replaceMovedSourceBasenameLinksWithCount(
        replacement.content,
        effectiveSourcePath,
        normalizedOldPath
      )
      : { content: replacement.content, count: 0 };
    replacement.content = movedSourceReplacement.content;
    replacement.count += movedSourceReplacement.count;

    if (replacement.content !== content) {
      let patchAbsolutePath = absolutePath;
      if (effectiveSourcePath !== sourcePath) {
        const movedAbsolutePath = resolveWorkspaceRelativePath(workspacePath, effectiveSourcePath);
        if (!movedAbsolutePath.ok) return movedAbsolutePath;
        patchAbsolutePath = movedAbsolutePath.value;
      }
      patches.push({
        absolutePath: patchAbsolutePath,
        linkCount: replacement.count,
        nextContent: replacement.content,
        previousContent: content,
        relativePath: effectiveSourcePath
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
): Promise<LinkUpdateTransactionResult> {
  const applied: LinkUpdatePatch[] = [];
  let activePatch: LinkUpdatePatch | null = null;

  try {
    for (const patch of patches) {
      activePatch = patch;
      await runMarkdownFileMutation(patch.absolutePath, async () => {
        const snapshot = await captureMarkdownMutationSnapshot(patch.absolutePath, operations);
        if (snapshot.content !== patch.previousContent) {
          throw new MarkdownMutationConflictError();
        }
        await writeLinkMutation(patch.absolutePath, patch.nextContent, snapshot, operations);
      });
      applied.push(patch);
      activePatch = null;
    }

    return { ok: true, value: undefined };
  } catch (error) {
    const rollbackCandidates = [...applied];
    const conflictedPaths: string[] = [];
    if (activePatch && !rollbackCandidates.includes(activePatch)) {
      try {
        const currentContent = await operations.readFile(activePatch.absolutePath, "utf8");
        if (currentContent === activePatch.nextContent) {
          rollbackCandidates.push(activePatch);
        } else if (currentContent !== activePatch.previousContent) {
          conflictedPaths.push(activePatch.relativePath);
        }
      } catch {
        conflictedPaths.push(activePatch.relativePath);
      }
    }
    const recovery = await rollbackAppliedPatches(rollbackCandidates, operations);
    recovery.conflictedPaths.push(...conflictedPaths);

    return isMarkdownMutationConflict(error)
      ? failureWithRecovery(
        "LINK_UPDATE_CONFLICT",
        "内部リンク更新対象のファイルが外部で変更されています。再読み込みしてから実行してください。",
        undefined,
        recovery
      )
      : failureWithRecovery(
        "LINK_UPDATE_WRITE_FAILED",
        "内部リンクを更新できませんでした。",
        errorDetails(error),
        recovery
      );
  }
}

async function writeLinkMutation(
  filePath: string,
  content: string,
  snapshot: MarkdownMutationSnapshot,
  operations: LinkUpdateWriteOperations
): Promise<void> {
  await assertMarkdownMutationSnapshotCurrent(filePath, snapshot, operations);

  if (operations.writeTextFile === atomicWriteTextFile) {
    await atomicWriteTextFile(filePath, content, undefined, {
      beforeRename: () => assertMarkdownMutationSnapshotCurrent(filePath, snapshot, operations)
    });
    return;
  }

  await operations.writeTextFile(filePath, content);
}

async function rollbackAppliedPatches(
  applied: LinkUpdatePatch[],
  operations: LinkUpdateWriteOperations
): Promise<LinkUpdateRecovery> {
  const recovery: LinkUpdateRecovery = {
    appliedPaths: applied.map((patch) => patch.relativePath),
    conflictedPaths: [],
    rolledBackPaths: [],
    rollbackFailedPaths: []
  };

  for (const patch of applied.toReversed()) {
    try {
      let rolledBack = false;
      let conflicted = false;
      await runMarkdownFileMutation(patch.absolutePath, async () => {
        const snapshot = await captureMarkdownMutationSnapshot(patch.absolutePath, operations);
        if (snapshot.content === patch.nextContent) {
          await writeLinkMutation(patch.absolutePath, patch.previousContent, snapshot, operations);
          rolledBack = true;
        } else if (snapshot.content !== patch.previousContent) {
          conflicted = true;
        }
      });
      if (rolledBack) recovery.rolledBackPaths.push(patch.relativePath);
      if (conflicted) recovery.conflictedPaths.push(patch.relativePath);
    } catch {
      recovery.rollbackFailedPaths.push(patch.relativePath);
    }
  }

  return recovery;
}

function withEmptyRecovery(error: RelicError): LinkUpdateTransactionResult {
  return {
    error,
    ok: false,
    recovery: {
      appliedPaths: [],
      conflictedPaths: [],
      rolledBackPaths: [],
      rollbackFailedPaths: []
    }
  };
}

function failureWithRecovery(
  code: string,
  message: string,
  details: string | undefined,
  recovery: LinkUpdateRecovery
): LinkUpdateTransactionResult {
  return {
    error: { code, details, message },
    ok: false,
    recovery
  };
}
