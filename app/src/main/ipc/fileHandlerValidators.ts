import type {
  CreateFolderInput,
  CreateMarkdownFileInput,
  ApplyUnlinkedReferenceInput,
  ImportImageFileInput,
  ImportMarkdownFilesInput,
  LinkUpdateImpactInput,
  MoveFolderInput,
  MoveItemToTrashInput,
  MoveMarkdownFileInput,
  ReadImageFileInput,
  ReadFileRecoverySnapshotInput,
  ReadPdfFileInput,
  RenameFolderInput,
  RenameMarkdownFileInput,
  ReplaceInFileInput,
  SearchAndReplaceInput,
  SearchMode,
  SearchWorkspaceInput,
  StartWorkspaceFileDragInput,
  WriteMarkdownFileInput
} from "../../shared/ipc";
import { isSupportedMarkdownImagePath } from "../../shared/imageFiles";
import { isSupportedPdfPath } from "../../shared/pdfFiles";
import {
  maxExpectedFileSnapshots,
  maxImportMarkdownFiles,
  maxMarkdownWriteBytes,
  maxReplacementBytes,
  maxSearchQueryLength,
  maxWorkspaceRelativePathLength
} from "../../shared/ipcLimits";
import { isWorkspaceRelativeInputPath, isWorkspaceRelativeInputPathOrRoot } from "../files/paths";
import { isWorkspaceIdInput } from "./workspaceHandlerValidators";

export function isCreateMarkdownFileInput(input: unknown): input is CreateMarkdownFileInput {
  return isNameInput(input);
}

export function isImportMarkdownFilesInput(input: unknown): input is ImportMarkdownFilesInput {
  if (typeof input !== "object" || input === null) return false;

  const candidate = input as { destinationFolder?: unknown; sourcePaths?: unknown };
  return (
    isLimitedWorkspaceRelativeInputPathOrRoot(candidate.destinationFolder) &&
    Array.isArray(candidate.sourcePaths) &&
    candidate.sourcePaths.length > 0 &&
    candidate.sourcePaths.length <= maxImportMarkdownFiles &&
    candidate.sourcePaths.every((sourcePath) => (
      typeof sourcePath === "string" &&
      sourcePath.trim() === sourcePath &&
      sourcePath.length > 0 &&
      !sourcePath.includes("\0")
    ))
  );
}

export function isImportImageFileInput(input: unknown): input is ImportImageFileInput {
  if (typeof input !== "object" || input === null) return false;

  const candidate = input as { destinationFolder?: unknown; sourcePath?: unknown };
  return (
    isLimitedWorkspaceRelativeInputPathOrRoot(candidate.destinationFolder) &&
    typeof candidate.sourcePath === "string" &&
    candidate.sourcePath.trim() === candidate.sourcePath &&
    candidate.sourcePath.length > 0 &&
    !candidate.sourcePath.includes("\0")
  );
}

export function isReadImageFileInput(input: unknown): input is ReadImageFileInput {
  return isPathInput(input) && isSupportedMarkdownImagePath(input.path);
}

export function isReadPdfFileInput(input: unknown): input is ReadPdfFileInput {
  return isPathInput(input) && isSupportedPdfPath(input.path);
}

export function isCreateFolderInput(input: unknown): input is CreateFolderInput {
  return (
    isNameInput(input) &&
    (
      !("parentFolder" in input) ||
      (input as { parentFolder?: unknown }).parentFolder === undefined ||
      isWorkspaceRelativeInputPathOrRoot((input as { parentFolder?: unknown }).parentFolder)
    )
  );
}

export function isLinkUpdateImpactInput(input: unknown): input is LinkUpdateImpactInput {
  if (typeof input !== "object" || input === null) return false;

  const candidate = input as Record<string, unknown>;
  return (
    (candidate.kind === "file" || candidate.kind === "folder") &&
      isLimitedWorkspaceRelativeInputPath(candidate.oldPath) &&
      isLimitedWorkspaceRelativeInputPath(candidate.newPath)
  );
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
    isLimitedWorkspaceRelativeInputPath((input as { path?: unknown }).path)
  );
}

export function isApplyUnlinkedReferenceInput(input: unknown): input is ApplyUnlinkedReferenceInput {
  if (typeof input !== "object" || input === null) return false;

  const candidate = input as {
    from?: unknown;
    matchText?: unknown;
    sourcePath?: unknown;
    targetPath?: unknown;
    to?: unknown;
  };

  return (
    isLimitedWorkspaceRelativeInputPath(candidate.sourcePath) &&
    isLimitedWorkspaceRelativeInputPath(candidate.targetPath) &&
    Number.isSafeInteger(candidate.from) &&
    Number.isSafeInteger(candidate.to) &&
    typeof candidate.from === "number" &&
    typeof candidate.to === "number" &&
    candidate.from >= 0 &&
    candidate.to >= candidate.from &&
    typeof candidate.matchText === "string" &&
    candidate.matchText.length > 0 &&
    candidate.matchText.length <= maxSearchQueryLength
  );
}

export function isReadFileRecoverySnapshotInput(input: unknown): input is ReadFileRecoverySnapshotInput {
  const candidate = input as { snapshotId?: unknown };
  return (
    isPathInput(input) &&
    typeof candidate.snapshotId === "string" &&
    /^[0-9T-Za-z-]+-[a-f0-9]{12}\.json$/.test(candidate.snapshotId)
  );
}

export function isPathOrRootInput(input: unknown): input is { path: string } {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    isLimitedWorkspaceRelativeInputPathOrRoot((input as { path?: unknown }).path)
  );
}

export function isRevealWorkspaceItemInput(input: unknown): input is { path: string; workspaceId?: string } {
  const workspaceId = (input as { workspaceId?: unknown })?.workspaceId;
  return (
    isPathOrRootInput(input) &&
    (workspaceId === undefined || isWorkspaceIdInput({ workspaceId }))
  );
}

export function isStartWorkspaceFileDragInput(input: unknown): input is StartWorkspaceFileDragInput {
  if (typeof input !== "object" || input === null) return false;

  const candidate = input as { paths?: unknown };
  return (
    Array.isArray(candidate.paths) &&
    candidate.paths.length > 0 &&
    candidate.paths.length <= maxImportMarkdownFiles &&
    candidate.paths.every(isLimitedWorkspaceRelativeInputPath)
  );
}

export function isRenameMarkdownFileInput(input: unknown): input is RenameMarkdownFileInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "newName" in input &&
    isLimitedWorkspaceRelativeInputPath((input as { path?: unknown }).path) &&
    typeof (input as { newName?: unknown }).newName === "string"
  );
}

export function isRenameFolderInput(input: unknown): input is RenameFolderInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "newName" in input &&
    isLimitedWorkspaceRelativeInputPath((input as { path?: unknown }).path) &&
    typeof (input as { newName?: unknown }).newName === "string"
  );
}

export function isMoveItemToTrashInput(input: unknown): input is MoveItemToTrashInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "type" in input &&
    isLimitedWorkspaceRelativeInputPath((input as { path?: unknown }).path) &&
    ((input as { type?: unknown }).type === "file" || (input as { type?: unknown }).type === "folder")
  );
}

export function isMoveMarkdownFileInput(input: unknown): input is MoveMarkdownFileInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "destinationFolder" in input &&
    isLimitedWorkspaceRelativeInputPath((input as { path?: unknown }).path) &&
    isLimitedWorkspaceRelativeInputPathOrRoot((input as { destinationFolder?: unknown }).destinationFolder)
  );
}

export function isMoveFolderInput(input: unknown): input is MoveFolderInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "destinationFolder" in input &&
    isLimitedWorkspaceRelativeInputPath((input as { path?: unknown }).path) &&
    isLimitedWorkspaceRelativeInputPathOrRoot((input as { destinationFolder?: unknown }).destinationFolder)
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
    isLimitedWorkspaceRelativeInputPath((input as { path?: unknown }).path) &&
    typeof (input as { searchQuery?: unknown }).searchQuery === "string" &&
    (input as { searchQuery: string }).searchQuery.length <= maxSearchQueryLength &&
    typeof (input as { replacement?: unknown }).replacement === "string" &&
    isWithinUtf8ByteLength((input as { replacement: string }).replacement, maxReplacementBytes) &&
    typeof (input as { isRegex?: unknown }).isRegex === "boolean"
  );
}

export function isWriteMarkdownFileInput(input: unknown): input is WriteMarkdownFileInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "content" in input &&
    isLimitedWorkspaceRelativeInputPath((input as { path?: unknown }).path) &&
    typeof (input as { content?: unknown }).content === "string" &&
    isWithinUtf8ByteLength((input as { content: string }).content, maxMarkdownWriteBytes) &&
    (
      !("expectedContent" in input) ||
      (
        typeof (input as { expectedContent?: unknown }).expectedContent === "string" &&
        isWithinUtf8ByteLength((input as { expectedContent: string }).expectedContent, maxMarkdownWriteBytes)
      )
    )
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
    (input as { searchQuery: string }).searchQuery.length <= maxSearchQueryLength &&
    typeof (input as { replacement?: unknown }).replacement === "string" &&
    isWithinUtf8ByteLength((input as { replacement: string }).replacement, maxReplacementBytes) &&
    typeof (input as { isRegex?: unknown }).isRegex === "boolean" &&
    (
      !("expectedFileSnapshots" in input) ||
      isSearchAndReplaceFileSnapshots((input as { expectedFileSnapshots?: unknown }).expectedFileSnapshots)
    )
  );
}

function isSearchAndReplaceFileSnapshots(input: unknown): boolean {
  return Array.isArray(input) &&
    input.length <= maxExpectedFileSnapshots &&
    input.every((item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { path?: unknown }).path === "string" &&
      typeof (item as { contentHash?: unknown }).contentHash === "string"
    );
}

export function isSearchWorkspaceInput(input: unknown): input is SearchWorkspaceInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "query" in input &&
    "mode" in input &&
    typeof (input as { query?: unknown }).query === "string" &&
    (input as { query: string }).query.length <= maxSearchQueryLength &&
    isSearchMode((input as { mode?: unknown }).mode) &&
    (
      !("frontmatterField" in input) ||
      (input as { frontmatterField?: unknown }).frontmatterField === undefined ||
      (
        typeof (input as { frontmatterField?: unknown }).frontmatterField === "string" &&
        (input as { frontmatterField: string }).frontmatterField.length <= maxSearchQueryLength
      )
    )
  );
}

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

  if (query === null || mode === null) {
    return null;
  }

  if (query.length > maxSearchQueryLength) {
    return null;
  }

  if (
    ("frontmatterField" in input &&
      record.frontmatterField !== undefined &&
      (
        typeof record.frontmatterField !== "string" ||
        record.frontmatterField.length > maxSearchQueryLength
      )) ||
    ("field" in input &&
      record.field !== undefined &&
      (
        typeof record.field !== "string" ||
        record.field.length > maxSearchQueryLength
      ))
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
    if (first.length > maxSearchQueryLength || (typeof third === "string" && third.length > maxSearchQueryLength)) {
      return null;
    }

    return {
      frontmatterField: typeof third === "string" ? third : undefined,
      mode: secondMode,
      query: first
    };
  }

  if (firstMode && typeof second === "string") {
    if (second.length > maxSearchQueryLength || (typeof third === "string" && third.length > maxSearchQueryLength)) {
      return null;
    }

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

function isLimitedWorkspaceRelativeInputPath(input: unknown): input is string {
  return typeof input === "string" &&
    input.length <= maxWorkspaceRelativePathLength &&
    isWorkspaceRelativeInputPath(input);
}

function isLimitedWorkspaceRelativeInputPathOrRoot(input: unknown): input is string {
  return typeof input === "string" &&
    input.length <= maxWorkspaceRelativePathLength &&
    isWorkspaceRelativeInputPathOrRoot(input);
}

function isWithinUtf8ByteLength(value: string, maxBytes: number): boolean {
  return Buffer.byteLength(value, "utf8") <= maxBytes;
}
