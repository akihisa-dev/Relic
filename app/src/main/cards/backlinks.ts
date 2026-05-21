import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Backlink } from "../../shared/ipc";
import { resolveWikiLinks } from "../../shared/links";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownCardPaths } from "../../shared/cardbookTree";
import { readCardbookAliases } from "./aliases";
import { readCardbookCardTree } from "./cardTree";
import { resolveCardbookRelativePath } from "./paths";

export async function readBacklinks(
  cardbookPath: string,
  targetRelativePath: string
): Promise<RelicResult<Backlink[]>> {
  if (path.extname(targetRelativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownカードだけバックリンクを確認できます。");
  }

  const targetPath = resolveCardbookRelativePath(cardbookPath, targetRelativePath);

  if (!targetPath.ok) {
    return targetPath;
  }

  try {
    const cardTree = await readCardbookCardTree(cardbookPath);
    const markdownPaths = collectMarkdownCardPaths(cardTree);
    const aliasesResult = await readCardbookAliases(cardbookPath);
    const aliasesByPath = aliasesResult.ok ? aliasesResult.value : {};
    const backlinks: Backlink[] = [];

    for (const sourcePath of markdownPaths) {
      if (sourcePath === targetRelativePath) continue;

      const sourceCard = resolveCardbookRelativePath(cardbookPath, sourcePath);

      if (!sourceCard.ok) continue;

      const content = await readFile(sourceCard.value, "utf8");
      const count = resolveWikiLinks(content, sourcePath, markdownPaths, aliasesByPath).filter(
        (link) => link.path === targetRelativePath
      ).length;

      if (count > 0) {
        backlinks.push({
          count,
          sourceName: path.basename(sourcePath, ".md"),
          sourcePath
        });
      }
    }

    return ok(backlinks.sort((a, b) => a.sourceName.localeCompare(b.sourceName, "ja")));
  } catch (error) {
    return fail(
      "BACKLINKS_READ_FAILED",
      "バックリンクを読み込めませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}
