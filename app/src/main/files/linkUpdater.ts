import { readFile } from "node:fs/promises";
import path from "node:path";

import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { fail, ok, type RelicResult } from "../../shared/result";
import { atomicWriteTextFile } from "./atomicWrite";
import { errorDetails } from "./fileSystem";
import { readWorkspaceFileTree } from "./fileTree";
import { replaceFileLinks, replaceFolderLinks } from "./linkUpdaterModel";
import { resolveExistingWorkspacePath } from "./paths";

interface LinkUpdatePatch {
  absolutePath: string;
  nextContent: string;
  previousContent: string;
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

  const fileTree = await readWorkspaceFileTree(workspacePath);
  const markdownPaths = collectMarkdownPaths(fileTree);

  const oldBaseName = path.basename(oldRelativePath, ".md");
  const newBaseName = path.basename(newRelativePath, ".md");
  const newPathWithoutExt = newRelativePath.replace(/\.md$/, "");
  const patches: LinkUpdatePatch[] = [];

  for (const sourcePath of markdownPaths) {
    const absoluteSourcePath = await resolveExistingWorkspacePath(workspacePath, sourcePath);
    if (!absoluteSourcePath.ok) return absoluteSourcePath;

    let content: string;
    try {
      content = await readFile(absoluteSourcePath.value, "utf8");
    } catch (err) {
      return fail("LINK_UPDATE_READ_FAILED", "内部リンク更新のためにファイルを読み込めませんでした。", errorDetails(err));
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
      patches.push({
        absolutePath: absoluteSourcePath.value,
        nextContent: updatedContent,
        previousContent: content
      });
    }
  }

  return applyLinkUpdatePatches(patches);
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

  const fileTree = await readWorkspaceFileTree(workspacePath);
  const markdownPaths = collectMarkdownPaths(fileTree);
  const patches: LinkUpdatePatch[] = [];

  for (const sourcePath of markdownPaths) {
    const absoluteSourcePath = await resolveExistingWorkspacePath(workspacePath, sourcePath);
    if (!absoluteSourcePath.ok) return absoluteSourcePath;

    let content: string;
    try {
      content = await readFile(absoluteSourcePath.value, "utf8");
    } catch (err) {
      return fail("LINK_UPDATE_READ_FAILED", "内部リンク更新のためにファイルを読み込めませんでした。", errorDetails(err));
    }

    const updatedContent = replaceFolderLinks(
      content,
      oldFolderRelativePath,
      newFolderRelativePath
    );

    if (updatedContent !== content) {
      patches.push({
        absolutePath: absoluteSourcePath.value,
        nextContent: updatedContent,
        previousContent: content
      });
    }
  }

  return applyLinkUpdatePatches(patches);
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
