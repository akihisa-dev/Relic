import type {
  CreateMarkdownFileInput,
  MoveFolderInput,
  MoveItemToTrashInput,
  MoveMarkdownFileInput,
  RenameFolderInput,
  RenameMarkdownFileInput,
  ReplaceInFileInput,
  SearchAndReplaceInput,
  SearchMode,
  SearchWorkspaceInput
} from "../../shared/ipc";

export function isCreateMarkdownFileInput(input: unknown): input is CreateMarkdownFileInput {
  return isNameInput(input);
}

export function isNameInput(input: unknown): input is { name: string } {
  return (
    typeof input === "object" &&
    input !== null &&
    "name" in input &&
    typeof (input as { name?: unknown }).name === "string"
  );
}

export function isPathInput(input: unknown): input is { path: string } {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    typeof (input as { path?: unknown }).path === "string"
  );
}

export function isRenameMarkdownFileInput(input: unknown): input is RenameMarkdownFileInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "newName" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { newName?: unknown }).newName === "string"
  );
}

export function isRenameFolderInput(input: unknown): input is RenameFolderInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "newName" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { newName?: unknown }).newName === "string"
  );
}

export function isMoveItemToTrashInput(input: unknown): input is MoveItemToTrashInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "type" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    ((input as { type?: unknown }).type === "file" || (input as { type?: unknown }).type === "folder")
  );
}

export function isMoveMarkdownFileInput(input: unknown): input is MoveMarkdownFileInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "destinationFolder" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { destinationFolder?: unknown }).destinationFolder === "string"
  );
}

export function isMoveFolderInput(input: unknown): input is MoveFolderInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "destinationFolder" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { destinationFolder?: unknown }).destinationFolder === "string"
  );
}

export function isReplaceInFileInput(input: unknown): input is ReplaceInFileInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "searchQuery" in input &&
    "replacement" in input &&
    "isRegex" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { searchQuery?: unknown }).searchQuery === "string" &&
    typeof (input as { replacement?: unknown }).replacement === "string" &&
    typeof (input as { isRegex?: unknown }).isRegex === "boolean"
  );
}

export function isSearchAndReplaceInput(input: unknown): input is SearchAndReplaceInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "searchQuery" in input &&
    "replacement" in input &&
    "isRegex" in input &&
    typeof (input as { searchQuery?: unknown }).searchQuery === "string" &&
    typeof (input as { replacement?: unknown }).replacement === "string" &&
    typeof (input as { isRegex?: unknown }).isRegex === "boolean"
  );
}

export function isSearchWorkspaceInput(input: unknown): input is SearchWorkspaceInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "query" in input &&
    "mode" in input &&
    typeof (input as { query?: unknown }).query === "string" &&
    isSearchMode((input as { mode?: unknown }).mode) &&
    (
      !("frontmatterField" in input) ||
      (input as { frontmatterField?: unknown }).frontmatterField === undefined ||
      typeof (input as { frontmatterField?: unknown }).frontmatterField === "string"
    )
  );
}

export function normalizeSearchWorkspaceInput(input: unknown): SearchWorkspaceInput | null {
  if (typeof input === "string") {
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

  if (query === null || mode === null) {
    return null;
  }

  if (
    ("frontmatterField" in input &&
      record.frontmatterField !== undefined &&
      typeof record.frontmatterField !== "string") ||
    ("field" in input && record.field !== undefined && typeof record.field !== "string")
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
    return {
      frontmatterField: typeof third === "string" ? third : undefined,
      mode: secondMode,
      query: first
    };
  }

  if (firstMode && typeof second === "string") {
    return {
      frontmatterField: typeof third === "string" ? third : undefined,
      mode: firstMode,
      query: second
    };
  }

  return null;
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

function isSearchMode(value: unknown): value is SearchMode {
  return parseSearchMode(value) === value;
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

  if (normalized === "regex" || normalized === "regular expression" || value === "正規表現") {
    return "regex";
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
