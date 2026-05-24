import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { readWorkspaceFileTree } from "./fileTree";
import { replaceFileLinks, replaceFolderLinks } from "./linkUpdaterModel";
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
