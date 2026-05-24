import { readFile } from "node:fs/promises";

import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { parseFrontmatter } from "./frontmatter";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveWorkspaceRelativePath } from "./paths";

export async function readFrontmatterValueCandidates(
  workspacePath: string
): Promise<RelicResult<Record<string, string[]>>> {
  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const valuesByField = new Map<string, Set<string>>();

    for (const relativePath of collectMarkdownPaths(fileTree)) {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");
      const { data } = parseFrontmatter(content);

      for (const [fieldName, value] of Object.entries(data)) {
        const fieldValues = valuesByField.get(fieldName) ?? new Set<string>();
        const values = stringifyCandidateValues(value);

        for (const item of values) fieldValues.add(item);
        valuesByField.set(fieldName, fieldValues);
      }
    }

    return ok(Object.fromEntries(
      [...valuesByField.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "ja"))
        .map(([fieldName, values]) => [
          fieldName,
          [...values].sort((a, b) => a.localeCompare(b, "ja"))
        ])
    ));
  } catch (error) {
    return fail(
      "FRONTMATTER_VALUE_CANDIDATES_READ_FAILED",
      "フロントマター候補を読み込めませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function stringifyCandidateValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringifyCandidateValues(item));
  }

  if (value instanceof Date) {
    return [value.toISOString().slice(0, 10)];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  return [];
}
