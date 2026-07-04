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
import { finishPerformanceMeasure, startPerformanceMeasure } from "./performanceLog";

export async function readBacklinks(
  workspacePath: string,
  targetRelativePath: string,
  optionsOrOperations: WorkspaceDerivedDataOptions | WorkspaceMarkdownReadOperations = {}
): Promise<RelicResult<Backlink[]>> {
  const startedAt = startPerformanceMeasure();
  if (!hasMarkdownExtension(targetRelativePath)) {
    finishPerformanceMeasure("readBacklinks", startedAt, { failed: true, reason: "unsupported_type" });
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけバックリンクを確認できます。");
  }

  const targetPath = resolveWorkspaceRelativePath(workspacePath, targetRelativePath);

  if (!targetPath.ok) {
    finishPerformanceMeasure("readBacklinks", startedAt, { failed: true, reason: "invalid_path" });
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
    const backlinksByTarget = parseCache.backlinksByTarget ?? buildBacklinksByTarget(fileIndex, parseCache, resolveLinks);
    parseCache.backlinksByTarget = backlinksByTarget;
    const sortedBacklinks = backlinksByTarget.get(targetRelativePath) ?? [];
    finishPerformanceMeasure("readBacklinks", startedAt, {
      backlinkCount: sortedBacklinks.length,
      records: fileIndex.records.length,
      targetPath: targetRelativePath
    });
    return ok(sortedBacklinks);
  } catch (error) {
    finishPerformanceMeasure("readBacklinks", startedAt, { failed: true, targetPath: targetRelativePath });
    return fail(
      "BACKLINKS_READ_FAILED",
      "バックリンクを読み込めませんでした。",
      errorDetails(error)
    );
  }
}

function buildBacklinksByTarget(
  fileIndex: Awaited<ReturnType<typeof readWorkspaceDerivedFileIndex>>,
  parseCache: ReturnType<typeof createWorkspaceDerivedDataCache>,
  resolveLinks: ReturnType<typeof createWikiLinkResolver>
): Map<string, Backlink[]> {
  const countsByTarget = new Map<string, Map<string, number>>();

  for (const record of readableWorkspaceMarkdownRecords(fileIndex)) {
    const content = markdownContentForRecord(record, parseCache);
    if (!content.includes("[[")) continue;

    for (const link of resolveLinks(content, record.path)) {
      if (link.path === record.path) continue;

      const sourceCounts = countsByTarget.get(link.path) ?? new Map<string, number>();
      sourceCounts.set(record.path, (sourceCounts.get(record.path) ?? 0) + 1);
      countsByTarget.set(link.path, sourceCounts);
    }
  }

  const backlinksByTarget = new Map<string, Backlink[]>();
  for (const [targetPath, sourceCounts] of countsByTarget.entries()) {
    backlinksByTarget.set(
      targetPath,
      [...sourceCounts.entries()]
        .map(([sourcePath, count]) => ({
          count,
          sourceName: stripMarkdownExtension(path.basename(sourcePath)),
          sourcePath
        }))
        .sort((a, b) => a.sourceName.localeCompare(b.sourceName, "ja"))
    );
  }

  return backlinksByTarget;
}
