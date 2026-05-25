import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  SearchMode,
  WorkspaceSearchResult,
  WorkspaceSearchResultSet
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { parseMarkdownTags } from "../../shared/tags";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { extractAliases } from "./aliases";
import { parseFrontmatter } from "./frontmatter";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveWorkspaceRelativePath } from "./paths";

export const workspaceSearchMaxResults = 500;
export const workspaceSearchMaxFileBytes = 2 * 1024 * 1024;

export async function searchWorkspace(
  workspacePath: string,
  query: string,
  mode: SearchMode,
  frontmatterField?: string
): Promise<RelicResult<WorkspaceSearchResultSet>> {
  const normalizedQuery = query.trim();
  const normalizedFrontmatterField = frontmatterField?.trim() ?? "";

  if (normalizedQuery === "") {
    return ok(emptySearchResultSet());
  }

  if (mode === "frontmatter" && normalizedFrontmatterField === "") {
    return ok(emptySearchResultSet());
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
    let skippedLargeFiles = 0;
    let truncated = false;

    for (const relativePath of collectMarkdownPaths(fileTree)) {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

      if (!absolutePath.ok) continue;

      const fileName = path.basename(relativePath, ".md");
      const content = await readFile(absolutePath.value, "utf8");

      if (Buffer.byteLength(content, "utf8") > workspaceSearchMaxFileBytes) {
        skippedLargeFiles += 1;
        continue;
      }

      if (mode === "fileName") {
        const alias = extractAliases(content).find((item) =>
          item.toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase())
        );

        if (fileName.toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase()) || alias) {
          results.push({ fileName, lineNumber: null, lineText: alias ? `alias: ${alias}` : relativePath, path: relativePath });
          if (results.length >= workspaceSearchMaxResults) {
            truncated = true;
            break;
          }
        }

        continue;
      }

      if (mode === "tag") {
        const tagQuery = normalizedQuery.replace(/^#/, "");

        if (parseMarkdownTags(content).tags.includes(tagQuery)) {
          results.push({ fileName, lineNumber: null, lineText: `tags: ${tagQuery}`, path: relativePath });
          if (results.length >= workspaceSearchMaxResults) {
            truncated = true;
            break;
          }
        }

        continue;
      }

      if (mode === "frontmatter") {
        const { data } = parseFrontmatter(content);
        const fieldValue = data[normalizedFrontmatterField];

        if (matchesFrontmatterField(fieldValue, normalizedQuery)) {
          results.push({
            fileName,
            lineNumber: null,
            lineText: `${normalizedFrontmatterField}: ${formatFrontmatterValue(fieldValue)}`,
            path: relativePath
          });
          if (results.length >= workspaceSearchMaxResults) {
            truncated = true;
            break;
          }
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
          if (results.length >= workspaceSearchMaxResults) {
            truncated = true;
            break;
          }
        }
      }

      if (truncated) break;
    }

    return ok({ results, skippedLargeFiles, truncated });
  } catch (error) {
    return fail(
      "SEARCH_FAILED",
      "検索できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function emptySearchResultSet(): WorkspaceSearchResultSet {
  return { results: [], skippedLargeFiles: 0, truncated: false };
}

function matchesFrontmatterField(value: unknown, query: string): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => String(item).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  }

  if (typeof value === "boolean") {
    const normalizedQuery = query.toLocaleLowerCase();

    if (["true", "1", "yes", "on"].includes(normalizedQuery)) {
      return value === true;
    }

    if (["false", "0", "no", "off"].includes(normalizedQuery)) {
      return value === false;
    }

    return String(value).toLocaleLowerCase() === normalizedQuery;
  }

  return String(value).toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function formatFrontmatterValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }

  return String(value);
}
