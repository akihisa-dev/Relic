import { readFile } from "node:fs/promises";

import type { WorkspaceTagSummary } from "../../shared/ipc";
import { parseMarkdownTags } from "../../shared/tags";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveWorkspaceRelativePath } from "./paths";

interface TagsReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

const defaultTagsReadOperations: TagsReadOperations = {
  readFile
};

export async function readWorkspaceTags(
  workspacePath: string,
  operations: TagsReadOperations = defaultTagsReadOperations
): Promise<RelicResult<WorkspaceTagSummary[]>> {
  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const tagCounts = new Map<string, number>();
    const files = collectMarkdownPaths(fileTree).flatMap((relativePath) => {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);
      return absolutePath.ok ? [{ absolutePath: absolutePath.value, relativePath }] : [];
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

      const { content } = fileContent;

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
