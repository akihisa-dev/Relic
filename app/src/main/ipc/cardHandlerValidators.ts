import type {
  CreateMarkdownCardInput,
  MoveCardFolderInput,
  MoveItemToTrashInput,
  MoveMarkdownCardInput,
  RenameCardFolderInput,
  RenameMarkdownCardInput,
  ReplaceInCardInput,
  SearchAndReplaceInput,
  SearchMode,
  SearchCardbookInput
} from "../../shared/ipc";

export function isCreateMarkdownCardInput(input: unknown): input is CreateMarkdownCardInput {
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

export function isRenameMarkdownCardInput(input: unknown): input is RenameMarkdownCardInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "newName" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { newName?: unknown }).newName === "string"
  );
}

export function isRenameCardFolderInput(input: unknown): input is RenameCardFolderInput {
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
    ((input as { type?: unknown }).type === "card" || (input as { type?: unknown }).type === "cardFolder")
  );
}

export function isMoveMarkdownCardInput(input: unknown): input is MoveMarkdownCardInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "destinationCardFolder" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { destinationCardFolder?: unknown }).destinationCardFolder === "string"
  );
}

export function isMoveCardFolderInput(input: unknown): input is MoveCardFolderInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "destinationCardFolder" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { destinationCardFolder?: unknown }).destinationCardFolder === "string"
  );
}

export function isReplaceInCardInput(input: unknown): input is ReplaceInCardInput {
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

export function isSearchCardbookInput(input: unknown): input is SearchCardbookInput {
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

export function normalizeSearchCardbookInput(input: unknown): SearchCardbookInput | null {
  if (typeof input === "string") {
    return { mode: "fullText", query: input };
  }

  if (Array.isArray(input)) {
    return normalizeSearchCardbookArgs(input);
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

function normalizeSearchCardbookArgs(args: unknown[]): SearchCardbookInput | null {
  if (args.length === 0) {
    return null;
  }

  if (args.length === 1) {
    return normalizeSearchCardbookInput(args[0]);
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

  if (normalized === "cardname" || normalized === "card name" || value === "カード名") {
    return "cardName";
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
    value === "プロパティ"
  ) {
    return "frontmatter";
  }

  return null;
}
