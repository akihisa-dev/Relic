import type { SearchMode, SearchWorkspaceInput } from "../../shared/ipc";
import { maxSearchQueryLength } from "../../shared/ipc/search";

/**
 * Converts search requests emitted by older renderer builds to the current IPC shape.
 * Keep this adapter at the main-process boundary so legacy aliases do not leak into
 * the current search implementation or its validators.
 */
export function normalizeSearchWorkspaceInput(input: unknown): SearchWorkspaceInput | null {
  if (typeof input === "string") {
    if (input.length > maxSearchQueryLength) return null;

    return { mode: "fullText", query: input };
  }

  if (Array.isArray(input)) {
    return normalizeSearchWorkspaceArgs(input);
  }

  if (typeof input !== "object" || input === null) {
    return null;
  }

  const record = input as {
    field?: unknown;
    frontmatterField?: unknown;
    keyword?: unknown;
    mode?: unknown;
    query?: unknown;
    searchMode?: unknown;
    searchQuery?: unknown;
    searchTerm?: unknown;
    term?: unknown;
    text?: unknown;
    type?: unknown;
    value?: unknown;
  };
  const query = firstString(
    record.query,
    record.searchQuery,
    record.searchTerm,
    record.term,
    record.keyword,
    record.value,
    record.text
  );
  const mode = firstSearchMode(record.mode, record.searchMode, record.type);
  const frontmatterField = firstString(record.frontmatterField, record.field);

  if (query === null || mode === null || query.length > maxSearchQueryLength) {
    return null;
  }

  if (
    ("frontmatterField" in input && !isOptionalLimitedString(record.frontmatterField)) ||
    ("field" in input && !isOptionalLimitedString(record.field))
  ) {
    return null;
  }

  return frontmatterField === null ? { mode, query } : { frontmatterField, mode, query };
}

function normalizeSearchWorkspaceArgs(args: unknown[]): SearchWorkspaceInput | null {
  if (args.length === 0) {
    return null;
  }

  if (args.length === 1) {
    return normalizeSearchWorkspaceInput(args[0]);
  }

  const first = args[0];
  const second = args[1];
  const third = args[2];
  const firstMode = parseSearchMode(first);
  const secondMode = parseSearchMode(second);

  if (typeof first === "string" && secondMode) {
    return createSearchInput(first, secondMode, third);
  }

  if (firstMode && typeof second === "string") {
    return createSearchInput(second, firstMode, third);
  }

  return null;
}

function createSearchInput(query: string, mode: SearchMode, field: unknown): SearchWorkspaceInput | null {
  if (query.length > maxSearchQueryLength || (typeof field === "string" && field.length > maxSearchQueryLength)) {
    return null;
  }

  return {
    frontmatterField: typeof field === "string" ? field : undefined,
    mode,
    query
  };
}

function isOptionalLimitedString(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && value.length <= maxSearchQueryLength);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
  }

  return null;
}

function firstSearchMode(...values: unknown[]): SearchMode | null {
  for (const value of values) {
    const mode = parseSearchMode(value);

    if (mode) {
      return mode;
    }
  }

  return null;
}

function parseSearchMode(value: unknown): SearchMode | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLocaleLowerCase();

  if (normalized === "fulltext" || normalized === "full text" || value === "全文") {
    return "fullText";
  }

  if (normalized === "filename" || normalized === "file name" || value === "ファイル名") {
    return "fileName";
  }

  if (normalized === "tag" || value === "タグ") {
    return "tag";
  }

  if (
    normalized === "frontmatter" ||
    normalized === "property" ||
    value === "プロパティ" ||
    value === "フロントマター"
  ) {
    return "frontmatter";
  }

  return null;
}
