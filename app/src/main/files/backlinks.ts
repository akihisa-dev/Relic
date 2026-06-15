import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Backlink } from "../../shared/ipc";
import { resolveWikiLinks } from "../../shared/links";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { readWorkspaceAliases } from "./aliases";
import { errorDetails } from "./fileSystem";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveWorkspaceRelativePath } from "./paths";

interface BacklinksReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

const defaultBacklinksReadOperations: BacklinksReadOperations = {
  readFile
};

export async function readBacklinks(
  workspacePath: string,
  targetRelativePath: string,
  operations: BacklinksReadOperations = defaultBacklinksReadOperations
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
    const files = markdownPaths.flatMap((sourcePath) => {
      if (sourcePath === targetRelativePath) return [];
      const sourceFile = resolveWorkspaceRelativePath(workspacePath, sourcePath);
      return sourceFile.ok ? [{ sourcePath, absolutePath: sourceFile.value }] : [];
    });
    const fileContents = await Promise.all(
      files.map(async (file) => {
        try {
          return { ...file, content: await operations.readFile(file.absolutePath, "utf8") };
        } catch {
          return null;
        }
      })
    );

    for (const fileContent of fileContents) {
      if (!fileContent) continue;

      const { content, sourcePath } = fileContent;
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
      errorDetails(error)
    );
  }
}
