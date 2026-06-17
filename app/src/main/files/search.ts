import { readFile, stat } from "node:fs/promises";
import type { Stats } from "node:fs";

import type {
  SearchMode,
  WorkspaceSearchResult,
  WorkspaceSearchResultSet
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { parseMarkdownTags } from "../../shared/tags";
import { extractAliases } from "./aliases";
import { errorDetails } from "./fileSystem";
import { parseFrontmatter } from "./frontmatter";
import { isRegexSafeLine, validateSafeRegexPattern } from "./regexSafety";
import { readWorkspaceFileIndex } from "./workspaceFileIndex";

export const workspaceSearchMaxResults = 500;
export const workspaceSearchMaxFileBytes = 2 * 1024 * 1024;

interface SearchOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  stat(filePath: string): Promise<Stats>;
}

export interface SearchWorkspaceOptions {
  cachePath?: string;
  fileIndexOperations?: SearchOperations;
}

const defaultSearchOperations: SearchOperations = {
  readFile,
  stat
};

export async function searchWorkspace(
  workspacePath: string,
  query: string,
  mode: SearchMode,
  frontmatterField?: string,
  options: SearchWorkspaceOptions = {}
): Promise<RelicResult<WorkspaceSearchResultSet>> {
  const normalizedQuery = query.trim();
  const normalizedQueryLower = normalizedQuery.toLocaleLowerCase();
  const normalizedFrontmatterField = frontmatterField?.trim() ?? "";

  if (normalizedQuery === "") {
    return ok(emptySearchResultSet());
  }

  if (mode === "frontmatter" && normalizedFrontmatterField === "") {
    return ok(emptySearchResultSet());
  }

  let regex: RegExp | null = null;

  if (mode === "regex") {
    const safePattern = validateSafeRegexPattern(normalizedQuery, "検索");
    if (!safePattern.ok) return safePattern;

    try {
      regex = new RegExp(normalizedQuery, "i");
    } catch {
      return fail("SEARCH_REGEX_INVALID", "正規表現が正しくありません。");
    }
  }

  try {
    const searchOperations = options.fileIndexOperations ?? defaultSearchOperations;

    const fileIndex = await readWorkspaceFileIndex(workspacePath, {
      maxSearchFileBytes: workspaceSearchMaxFileBytes,
      operations: {
        readFile: (filePath) => searchOperations.readFile(filePath, "utf8"),
        stat: searchOperations.stat
      },
      cachePath: options.cachePath
    });
    const results: WorkspaceSearchResult[] = [];
    const skippedLargeFiles = fileIndex.records.filter(
      (record) => record.readStatus === "ok" && !record.searchable
    ).length;
    let skippedLongLines = 0;
    let truncated = false;

    for (const record of fileIndex.records) {
      if (record.readStatus !== "ok" || !record.searchable) continue;

      const fileName = record.name;
      const relativePath = record.path;
      const content = record.lines.join("\n");

      if (mode === "fileName") {
        let alias: string | null = null;
        for (const item of extractAliases(content)) {
          if (item.toLocaleLowerCase().includes(normalizedQueryLower)) {
            alias = item;
            break;
          }
        }

        if (fileName.toLocaleLowerCase().includes(normalizedQueryLower) || alias) {
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

        if (new Set(parseMarkdownTags(content).tags).has(tagQuery)) {
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

        if (matchesFrontmatterField(fieldValue, normalizedQueryLower)) {
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

      for (const [index, line] of record.lines.entries()) {
        if (mode === "regex" && !isRegexSafeLine(line)) {
          skippedLongLines += 1;
          continue;
        }

        const matches =
          mode === "regex"
            ? regex!.test(line)
            : line.toLocaleLowerCase().includes(normalizedQueryLower);

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

    return ok({ results, skippedLargeFiles, skippedLongLines, truncated });
  } catch (error) {
    return fail(
      "SEARCH_FAILED",
      "検索できませんでした。",
      errorDetails(error)
    );
  }
}

function emptySearchResultSet(): WorkspaceSearchResultSet {
  return {
    results: [],
    skippedLongLines: 0,
    skippedLargeFiles: 0,
    truncated: false
  };
}

function matchesFrontmatterField(value: unknown, queryLower: string): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => String(item).toLocaleLowerCase().includes(queryLower));
  }

  if (typeof value === "boolean") {
    if (["true", "1", "yes", "on"].includes(queryLower)) {
      return value === true;
    }

    if (["false", "0", "no", "off"].includes(queryLower)) {
      return value === false;
    }

    return String(value).toLocaleLowerCase() === queryLower;
  }

  return String(value).toLocaleLowerCase().includes(queryLower);
}

function formatFrontmatterValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }

  return String(value);
}
