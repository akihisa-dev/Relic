import type {
  CreateMarkdownFileInput,
  MoveFolderInput,
  MoveItemToTrashInput,
  MoveMarkdownFileInput,
  RenameFolderInput,
  RenameMarkdownFileInput,
  ReplaceInFileInput,
  SearchAndReplaceInput,
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
    (!("frontmatterField" in input) || typeof (input as { frontmatterField?: unknown }).frontmatterField === "string") &&
    ((input as { mode?: unknown }).mode === "fullText" ||
      (input as { mode?: unknown }).mode === "fileName" ||
      (input as { mode?: unknown }).mode === "tag" ||
      (input as { mode?: unknown }).mode === "regex" ||
      (input as { mode?: unknown }).mode === "frontmatter")
  );
}
