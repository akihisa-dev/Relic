import { readFile } from "node:fs/promises";

import type { WorkspaceTagSummary } from "../../shared/ipc";
import { parseMarkdownTags } from "../../shared/tags";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveWorkspaceRelativePath } from "./paths";

export async function readWorkspaceTags(
  workspacePath: string
): Promise<RelicResult<WorkspaceTagSummary[]>> {
  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const tagCounts = new Map<string, number>();

    for (const relativePath of collectMarkdownPaths(fileTree)) {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");

      for (const tag of parseMarkdownTags(content).tags) {
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
      error instanceof Error ? error.message : String(error)
    );
  }
}
