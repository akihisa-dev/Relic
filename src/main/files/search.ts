import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  SearchMode,
  WorkspaceSearchResult,
  WorkspaceTreeNode
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { parseMarkdownTags } from "../../shared/tags";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveWorkspaceRelativePath } from "./paths";

export async function searchWorkspace(
  workspacePath: string,
  query: string,
  mode: SearchMode
): Promise<RelicResult<WorkspaceSearchResult[]>> {
  const normalizedQuery = query.trim();

  if (normalizedQuery === "") {
    return ok([]);
  }

  let regex: RegExp | null = null;

  if (mode === "regex") {
    try {
      regex = new RegExp(normalizedQuery, "i");
    } catch {
      return fail("SEARCH_REGEX_INVALID", "正規表現が正しくありません。");
    }
  }

  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const results: WorkspaceSearchResult[] = [];

    for (const relativePath of collectMarkdownPaths(fileTree)) {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

      if (!absolutePath.ok) continue;

      const fileName = path.basename(relativePath, ".md");
      const content = await readFile(absolutePath.value, "utf8");

      if (mode === "fileName") {
        if (fileName.toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase())) {
          results.push({ fileName, lineNumber: null, lineText: relativePath, path: relativePath });
        }

        continue;
      }

      if (mode === "tag") {
        const tagQuery = normalizedQuery.replace(/^#/, "");

        if (parseMarkdownTags(content).tags.includes(tagQuery)) {
          results.push({ fileName, lineNumber: null, lineText: `#${tagQuery}`, path: relativePath });
        }

        continue;
      }

      const lines = content.split("\n");

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const matches =
          mode === "regex"
            ? regex!.test(line)
            : line.toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase());

        if (matches) {
          results.push({
            fileName,
            lineNumber: index + 1,
            lineText: line.trim() === "" ? "(空行)" : line.trim(),
            path: relativePath
          });
        }
      }
    }

    return ok(results);
  } catch (error) {
    return fail(
      "SEARCH_FAILED",
      "検索できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function collectMarkdownPaths(nodes: WorkspaceTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "file" ? [node.path] : collectMarkdownPaths(node.children)
  );
}
