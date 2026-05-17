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
    (!("frontmatterField" in input) || typeof (input as { frontmatterField?: unknown }).frontmatterField === "string")
  );
}

export function normalizeSearchWorkspaceInput(input: unknown): SearchWorkspaceInput | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const record = input as {
    frontmatterField?: unknown;
    mode?: unknown;
    query?: unknown;
    searchMode?: unknown;
    searchQuery?: unknown;
  };
  const query = typeof record.query === "string"
    ? record.query
    : typeof record.searchQuery === "string"
      ? record.searchQuery
      : null;
  const mode = isSearchMode(record.mode)
    ? record.mode
    : isSearchMode(record.searchMode)
      ? record.searchMode
      : null;

  if (query === null || mode === null) {
    return null;
  }

  if ("frontmatterField" in input && typeof record.frontmatterField !== "string") {
    return null;
  }

  return {
    frontmatterField: typeof record.frontmatterField === "string" ? record.frontmatterField : undefined,
    mode,
    query
  };
}

function isSearchMode(value: unknown): value is SearchMode {
  return (
    value === "fullText" ||
    value === "fileName" ||
    value === "tag" ||
    value === "regex" ||
    value === "frontmatter"
  );
}
