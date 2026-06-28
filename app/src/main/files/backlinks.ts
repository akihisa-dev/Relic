import path from "node:path";

import type { Backlink } from "../../shared/ipc";
import { createWikiLinkResolver } from "../../shared/links";
import { hasMarkdownExtension, stripMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readWorkspaceAliases } from "./aliases";
import { errorDetails } from "./fileSystem";
import { resolveWorkspaceRelativePath } from "./paths";
import {
  createWorkspaceDerivedDataCache,
  markdownContentForRecord,
  normalizeWorkspaceDerivedDataOptions,
  readableWorkspaceMarkdownRecords,
  readWorkspaceDerivedFileIndex,
  type WorkspaceDerivedDataOptions,
  type WorkspaceMarkdownReadOperations
} from "./workspaceDerivedData";

export async function readBacklinks(
  workspacePath: string,
  targetRelativePath: string,
  optionsOrOperations: WorkspaceDerivedDataOptions | WorkspaceMarkdownReadOperations = {}
): Promise<RelicResult<Backlink[]>> {
  if (!hasMarkdownExtension(targetRelativePath)) {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけバックリンクを確認できます。");
  }

  const targetPath = resolveWorkspaceRelativePath(workspacePath, targetRelativePath);

  if (!targetPath.ok) {
    return targetPath;
  }

  try {
    const options = normalizeWorkspaceDerivedDataOptions(optionsOrOperations);
    const parseCache = options.parseCache ?? createWorkspaceDerivedDataCache();
    const fileIndex = await readWorkspaceDerivedFileIndex(workspacePath, options);
    const markdownPaths = fileIndex.entries.map((entry) => entry.path);
    const aliasesResult = await readWorkspaceAliases(workspacePath, {
      ...options,
      fileIndex,
      parseCache
    });
    const aliasesByPath = aliasesResult.ok ? aliasesResult.value : {};
    const resolveLinks = createWikiLinkResolver(markdownPaths, aliasesByPath);
    const backlinks: Backlink[] = [];

    for (const record of readableWorkspaceMarkdownRecords(fileIndex)) {
      if (record.path === targetRelativePath) continue;

      const content = markdownContentForRecord(record, parseCache);
      const backlinksForSource = content.includes("[[")
        ? resolveLinks(content, record.path).filter((link) => link.path === targetRelativePath)
        : [];
      const count = backlinksForSource.length;

      if (count > 0) {
        backlinks.push({
          count,
          sourceName: stripMarkdownExtension(path.basename(record.path)),
          sourcePath: record.path
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
