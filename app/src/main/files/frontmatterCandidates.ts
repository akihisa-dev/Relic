import { readFile } from "node:fs/promises";

import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { parseFrontmatter } from "./frontmatter";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveWorkspaceRelativePath } from "./paths";

interface FrontmatterCandidateReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

const defaultFrontmatterCandidateReadOperations: FrontmatterCandidateReadOperations = {
  readFile
};

export async function readFrontmatterValueCandidates(
  workspacePath: string,
  operations: FrontmatterCandidateReadOperations = defaultFrontmatterCandidateReadOperations
): Promise<RelicResult<Record<string, string[]>>> {
  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const valuesByField = new Map<string, Set<string>>();
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
      const { data } = parseFrontmatter(content);

      for (const [fieldName, value] of Object.entries(data)) {
        const fieldValues = valuesByField.get(fieldName) ?? new Set<string>();
        const values = stringifyCandidateValues(value);

        for (const item of values) fieldValues.add(item);
        valuesByField.set(fieldName, fieldValues);
      }
    }

    return ok(Object.fromEntries(
      Array.from(valuesByField.entries())
        .toSorted(([a], [b]) => a.localeCompare(b, "ja"))
        .map(([fieldName, values]) => [
          fieldName,
          Array.from(values).toSorted((a, b) => a.localeCompare(b, "ja"))
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
