import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Backlink, WorkspaceTreeNode } from "../../shared/ipc";
import { resolveWikiLinks } from "../../shared/links";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readWorkspaceAliases } from "./aliases";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveWorkspaceRelativePath } from "./paths";

export async function readBacklinks(
  workspacePath: string,
  targetRelativePath: string
): Promise<RelicResult<Backlink[]>> {
  if (path.extname(targetRelativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけバックリンクを確認できます。");
  }

  const targetPath = resolveWorkspaceRelativePath(workspacePath, targetRelativePath);

  if (!targetPath.ok) {
    return targetPath;
  }

  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const markdownPaths = collectMarkdownPaths(fileTree);
    const aliasesResult = await readWorkspaceAliases(workspacePath);
    const aliasesByPath = aliasesResult.ok ? aliasesResult.value : {};
    const backlinks: Backlink[] = [];

    for (const sourcePath of markdownPaths) {
      if (sourcePath === targetRelativePath) continue;

      const sourceFile = resolveWorkspaceRelativePath(workspacePath, sourcePath);

      if (!sourceFile.ok) continue;

      const content = await readFile(sourceFile.value, "utf8");
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

function collectMarkdownPaths(nodes: WorkspaceTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "file" ? [node.path] : collectMarkdownPaths(node.children)
  );
}
