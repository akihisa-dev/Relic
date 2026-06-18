import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Backlink } from "../../shared/ipc";
import { createWikiLinkResolver } from "../../shared/links";
import { hasMarkdownExtension, stripMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { readWorkspaceAliases } from "./aliases";
import { errorDetails } from "./fileSystem";
import { readWorkspaceFileTree } from "./fileTree";
import { mapWithConcurrency } from "./concurrency";
import { resolveWorkspaceRelativePath } from "./paths";

interface BacklinksReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

const defaultBacklinksReadOperations: BacklinksReadOperations = {
  readFile
};

const maxConcurrentBacklinkReads = 8;

export async function readBacklinks(
  workspacePath: string,
  targetRelativePath: string,
  operations: BacklinksReadOperations = defaultBacklinksReadOperations
): Promise<RelicResult<Backlink[]>> {
  if (!hasMarkdownExtension(targetRelativePath)) {
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
    const resolveLinks = createWikiLinkResolver(markdownPaths, aliasesByPath);
    const backlinks: Backlink[] = [];
    const files = markdownPaths.flatMap((sourcePath) => {
      if (sourcePath === targetRelativePath) return [];
      const sourceFile = resolveWorkspaceRelativePath(workspacePath, sourcePath);
      return sourceFile.ok ? [{ sourcePath, absolutePath: sourceFile.value }] : [];
    });
    const fileContents = await mapWithConcurrency(
      files,
      maxConcurrentBacklinkReads,
      async (file) => {
        try {
          const content = await operations.readFile(file.absolutePath, "utf8");

          if (!content.includes("[[")) {
            return { ...file, content: null };
          }

          return { ...file, content };
        } catch {
          return null;
        }
      }
    );

    for (const fileContent of fileContents) {
      if (!fileContent) continue;

      const { content, sourcePath } = fileContent;
      const backlinksForSource = content
        ? resolveLinks(content, sourcePath).filter((link) => link.path === targetRelativePath)
        : [];
      const count = backlinksForSource.length;

      if (count > 0) {
        backlinks.push({
          count,
          sourceName: stripMarkdownExtension(path.basename(sourcePath)),
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
