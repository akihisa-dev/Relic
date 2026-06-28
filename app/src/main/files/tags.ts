import type { WorkspaceTagSummary } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails } from "./fileSystem";
import {
  createWorkspaceDerivedDataCache,
  normalizeWorkspaceDerivedDataOptions,
  readableWorkspaceMarkdownRecords,
  readWorkspaceDerivedFileIndex,
  tagsForRecord,
  type WorkspaceDerivedDataOptions,
  type WorkspaceMarkdownReadOperations
} from "./workspaceDerivedData";

export async function readWorkspaceTags(
  workspacePath: string,
  optionsOrOperations: WorkspaceDerivedDataOptions | WorkspaceMarkdownReadOperations = {}
): Promise<RelicResult<WorkspaceTagSummary[]>> {
  try {
    const options = normalizeWorkspaceDerivedDataOptions(optionsOrOperations);
    const parseCache = options.parseCache ?? createWorkspaceDerivedDataCache();
    const fileIndex = await readWorkspaceDerivedFileIndex(workspacePath, options);
    const tagCounts = new Map<string, number>();

    for (const record of readableWorkspaceMarkdownRecords(fileIndex)) {
      for (const tag of tagsForRecord(record, parseCache)) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    return ok(
      [...tagCounts.entries()]
        .map(([tag, count]) => ({ count, tag }))
        .sort((a, b) => a.tag.localeCompare(b.tag, "ja"))
    );
  } catch (error) {
    return fail(
      "TAGS_READ_FAILED",
      "タグを読み込めませんでした。",
      errorDetails(error)
    );
  }
}
