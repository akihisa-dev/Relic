import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { collectMarkdownCardPaths } from "../../shared/cardbookTree";
import { readCardbookCardTree } from "./cardTree";
import { replaceCardLinks, replaceCardFolderLinks } from "./linkUpdaterModel";
import { resolveCardbookRelativePath } from "./paths";

/**
 * カードリネーム後、カードブック内の内部リンクを一括更新する。
 * - basename-only リンク（[[カード名]]）：同じカードフォルダ内のカードからのリンクを更新
 * - パス付きリンク（[[カードフォルダ/カード名]]）：任意のカードからのリンクを更新
 */
export async function updateLinksForCardRename(
  cardbookPath: string,
  oldRelativePath: string,
  newRelativePath: string
): Promise<void> {
  if (oldRelativePath === newRelativePath) return;

  const cardTree = await readCardbookCardTree(cardbookPath);
  const markdownPaths = collectMarkdownCardPaths(cardTree);

  const oldBaseName = path.basename(oldRelativePath, ".md");
  const newBaseName = path.basename(newRelativePath, ".md");
  const newPathWithoutExt = newRelativePath.replace(/\.md$/, "");

  for (const sourcePath of markdownPaths) {
    const absoluteSourcePath = resolveCardbookRelativePath(cardbookPath, sourcePath);
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

    const updatedContent = replaceCardLinks(
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
 * カードフォルダリネーム後、パス付き内部リンクを一括更新する。
 * basename-only リンクはカードフォルダ内カード同士の相対関係が保たれるため更新不要。
 */
export async function updateLinksForCardFolderRename(
  cardbookPath: string,
  oldCardFolderRelativePath: string,
  newCardFolderRelativePath: string
): Promise<void> {
  if (oldCardFolderRelativePath === newCardFolderRelativePath) return;

  const cardTree = await readCardbookCardTree(cardbookPath);
  const markdownPaths = collectMarkdownCardPaths(cardTree);

  for (const sourcePath of markdownPaths) {
    const absoluteSourcePath = resolveCardbookRelativePath(cardbookPath, sourcePath);
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

    const updatedContent = replaceCardFolderLinks(
      content,
      oldCardFolderRelativePath,
      newCardFolderRelativePath
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
