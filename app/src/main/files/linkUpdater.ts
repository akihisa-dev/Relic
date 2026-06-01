import { readFile } from "node:fs/promises";
import path from "node:path";

import { collectMarkdownPaths } from "../../shared/workspaceTree";
import type { LinkUpdateImpact, LinkUpdateImpactKind } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { atomicWriteTextFile } from "./atomicWrite";
import { errorDetails } from "./fileSystem";
import { readWorkspaceFileTree } from "./fileTree";
import { replaceFileLinksWithCount, replaceFolderLinksWithCount } from "./linkUpdaterModel";
import { resolveExistingWorkspacePath, toWorkspaceRelativePath } from "./paths";

interface LinkUpdatePatch {
  absolutePath: string;
  linkCount: number;
  nextContent: string;
  previousContent: string;
}

interface LinkUpdateReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

const defaultLinkUpdateReadOperations: LinkUpdateReadOperations = {
  readFile
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
  newRelativePath: string
): Promise<RelicResult<void>> {
  if (oldRelativePath === newRelativePath) return ok(undefined);

  const patches = await buildLinkUpdatePatches(workspacePath, "file", oldRelativePath, newRelativePath, {
    operations: defaultLinkUpdateReadOperations,
    skipUnreadableFiles: false
  });
  if (!patches.ok) return patches;

  return applyLinkUpdatePatches(patches.value);
}

/**
 * フォルダリネーム後、パス付き内部リンクを一括更新する。
 * basename-only リンクはフォルダ内ファイル同士の相対関係が保たれるため更新不要。
 */
export async function updateLinksForFolderRename(
  workspacePath: string,
  oldFolderRelativePath: string,
  newFolderRelativePath: string
): Promise<RelicResult<void>> {
  if (oldFolderRelativePath === newFolderRelativePath) return ok(undefined);

  const patches = await buildLinkUpdatePatches(workspacePath, "folder", oldFolderRelativePath, newFolderRelativePath, {
    operations: defaultLinkUpdateReadOperations,
    skipUnreadableFiles: false
  });
  if (!patches.ok) return patches;

  return applyLinkUpdatePatches(patches.value);
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
): Promise<RelicResult<LinkUpdatePatch[]>> {
  if (oldPath === newPath) return ok([]);

  const normalizedOldPath = toWorkspaceRelativePath(oldPath);
  const normalizedNewPath = toWorkspaceRelativePath(newPath);

  const fileTree = await readWorkspaceFileTree(workspacePath);
  const markdownPaths = collectMarkdownPaths(fileTree);
  const patches: LinkUpdatePatch[] = [];
  const newBaseName = path.posix.basename(normalizedNewPath, ".md");
  const newPathWithoutExt = normalizedNewPath.replace(/\.md$/, "");

  for (const sourcePath of markdownPaths) {
    const absoluteSourcePath = await resolveExistingWorkspacePath(workspacePath, sourcePath);
    if (!absoluteSourcePath.ok) return absoluteSourcePath;

    let content: string;
    try {
      content = await options.operations.readFile(absoluteSourcePath.value, "utf8");
    } catch (err) {
      if (options.skipUnreadableFiles) continue;

      return fail("LINK_UPDATE_READ_FAILED", "内部リンク更新のためにファイルを読み込めませんでした。", errorDetails(err));
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

    if (replacement.content !== content) {
      patches.push({
        absolutePath: absoluteSourcePath.value,
        linkCount: replacement.count,
        nextContent: replacement.content,
        previousContent: content
      });
    }
  }

  return ok(patches);
}

function summarizeLinkUpdatePatches(patches: LinkUpdatePatch[]): LinkUpdateImpact {
  return {
    fileCount: patches.length,
    linkCount: patches.reduce((sum, patch) => sum + patch.linkCount, 0)
  };
}

async function applyLinkUpdatePatches(patches: LinkUpdatePatch[]): Promise<RelicResult<void>> {
  const applied: LinkUpdatePatch[] = [];

  try {
    for (const patch of patches) {
      await atomicWriteTextFile(patch.absolutePath, patch.nextContent);
      applied.push(patch);
    }

    return ok(undefined);
  } catch (error) {
    for (const patch of applied.reverse()) {
      await atomicWriteTextFile(patch.absolutePath, patch.previousContent).catch(() => undefined);
    }

    return fail("LINK_UPDATE_WRITE_FAILED", "内部リンクを更新できませんでした。", errorDetails(error));
  }
}
