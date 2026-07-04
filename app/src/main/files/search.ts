import { readFile, stat } from "node:fs/promises";
import type { Stats } from "node:fs";

import type {
  SearchMode,
  WorkspaceSearchResult,
  WorkspaceSearchResultSet
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails } from "./fileSystem";
import {
  aliasesForRecord,
  frontmatterForRecord,
  readWorkspaceDerivedFileIndex,
  tagsForRecord,
  type WorkspaceDerivedDataCache,
  type WorkspaceDerivedDataOptions
} from "./workspaceDerivedData";
import { readWorkspaceFileIndex, type WorkspaceFileIndex } from "./workspaceFileIndex";
import { finishPerformanceMeasure, startPerformanceMeasure } from "./performanceLog";

export const workspaceSearchMaxResults = 500;
export const workspaceSearchMaxFileBytes = 2 * 1024 * 1024;

interface SearchOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  stat(filePath: string): Promise<Stats>;
}

export interface SearchWorkspaceOptions {
  cachePath?: string;
  fileIndex?: WorkspaceFileIndex;
  fileIndexOperations?: SearchOperations;
  parseCache?: WorkspaceDerivedDataCache;
  shouldContinue?: () => boolean;
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
  const startedAt = startPerformanceMeasure();
  const normalizedQuery = query.trim();
  const normalizedQueryLower = normalizedQuery.toLocaleLowerCase();
  const normalizedFrontmatterField = frontmatterField?.trim() ?? "";

  if (normalizedQuery === "") {
    finishPerformanceMeasure("searchWorkspace", startedAt, { mode, resultCount: 0, skipped: true });
    return ok(emptySearchResultSet());
  }

  if (mode === "frontmatter" && normalizedFrontmatterField === "") {
    finishPerformanceMeasure("searchWorkspace", startedAt, { mode, resultCount: 0, skipped: true });
    return ok(emptySearchResultSet());
  }

  try {
    if (options.shouldContinue && !options.shouldContinue()) {
      finishPerformanceMeasure("searchWorkspace", startedAt, { cancelled: true, mode, resultCount: 0 });
      return ok(emptySearchResultSet());
    }

    const searchOperations = options.fileIndexOperations ?? defaultSearchOperations;

    const derivedOptions: WorkspaceDerivedDataOptions = {
      cachePath: options.cachePath,
      fileIndex: options.fileIndex,
      maxSearchFileBytes: workspaceSearchMaxFileBytes,
      operations: {
        readFile: (filePath) => searchOperations.readFile(filePath, "utf8"),
        stat: searchOperations.stat
      },
      parseCache: options.parseCache
    };
    const fileIndex = options.fileIndex
      ? await readWorkspaceDerivedFileIndex(workspacePath, derivedOptions)
      : await readWorkspaceFileIndex(workspacePath, {
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
    let truncated = false;

    for (const record of fileIndex.records) {
      if (options.shouldContinue && !options.shouldContinue()) {
        finishPerformanceMeasure("searchWorkspace", startedAt, { cancelled: true, mode, resultCount: 0 });
        return ok(emptySearchResultSet());
      }

      if (record.readStatus !== "ok" || !record.searchable) continue;

      const fileName = record.name;
      const relativePath = record.path;

      if (mode === "fileName") {
        let alias: string | null = null;
        for (const item of aliasesForRecord(record, options.parseCache)) {
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

        if (new Set(tagsForRecord(record, options.parseCache)).has(tagQuery)) {
          results.push({ fileName, lineNumber: null, lineText: `tags: ${tagQuery}`, path: relativePath });
          if (results.length >= workspaceSearchMaxResults) {
            truncated = true;
            break;
          }
        }

        continue;
      }

      if (mode === "frontmatter") {
        const { data } = frontmatterForRecord(record, options.parseCache);
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
        if (index % 50 === 0 && options.shouldContinue && !options.shouldContinue()) {
          finishPerformanceMeasure("searchWorkspace", startedAt, { cancelled: true, mode, resultCount: 0 });
          return ok(emptySearchResultSet());
        }

        const matches = line.toLocaleLowerCase().includes(normalizedQueryLower);

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

    finishPerformanceMeasure("searchWorkspace", startedAt, {
      mode,
      resultCount: results.length,
      skippedLargeFiles,
      truncated
    });
    return ok({ results, skippedLargeFiles, skippedLongLines: 0, truncated });
  } catch (error) {
    finishPerformanceMeasure("searchWorkspace", startedAt, { failed: true, mode });
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
