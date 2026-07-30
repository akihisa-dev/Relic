import type {
  ApplyUnlinkedReferenceInput,
  ReplaceInFileInput,
  SearchAndReplaceInput,
  SearchWorkspaceInput
} from "../../shared/ipc";
import {
  maxExpectedFileSnapshots,
  maxReplacementBytes,
  maxSearchQueryLength
} from "../../shared/ipc/search";
import {
  isInputRecord,
  isLimitedWorkspaceRelativeInputPath,
  isWithinUtf8ByteLength
} from "./inputValidation";

export function isApplyUnlinkedReferenceInput(
  input: unknown
): input is ApplyUnlinkedReferenceInput {
  if (!isInputRecord(input)) return false;

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

export function isReplaceInFileInput(input: unknown): input is ReplaceInFileInput {
  return (
    isInputRecord(input) &&
    "path" in input &&
    "searchQuery" in input &&
    "replacement" in input &&
    "isRegex" in input &&
    isLimitedWorkspaceRelativeInputPath(input.path) &&
    typeof input.searchQuery === "string" &&
    input.searchQuery.length <= maxSearchQueryLength &&
    typeof input.replacement === "string" &&
    isWithinUtf8ByteLength(input.replacement, maxReplacementBytes) &&
    typeof input.isRegex === "boolean"
  );
}

export function isSearchAndReplaceInput(
  input: unknown
): input is SearchAndReplaceInput {
  return (
    isInputRecord(input) &&
    "searchQuery" in input &&
    "replacement" in input &&
    "isRegex" in input &&
    typeof input.searchQuery === "string" &&
    input.searchQuery.length <= maxSearchQueryLength &&
    typeof input.replacement === "string" &&
    isWithinUtf8ByteLength(input.replacement, maxReplacementBytes) &&
    typeof input.isRegex === "boolean" &&
    (
      !("expectedFileSnapshots" in input) ||
      isSearchAndReplaceFileSnapshots(input.expectedFileSnapshots)
    )
  );
}

export function isSearchWorkspaceInput(input: unknown): input is SearchWorkspaceInput {
  return (
    isInputRecord(input) &&
    "query" in input &&
    "mode" in input &&
    typeof input.query === "string" &&
    input.query.length <= maxSearchQueryLength &&
    isSearchMode(input.mode) &&
    (
      !("frontmatterField" in input) ||
      input.frontmatterField === undefined ||
      (
        typeof input.frontmatterField === "string" &&
        input.frontmatterField.length <= maxSearchQueryLength
      )
    )
  );
}

function isSearchAndReplaceFileSnapshots(input: unknown): boolean {
  return Array.isArray(input) &&
    input.length <= maxExpectedFileSnapshots &&
    input.every((item) =>
      isInputRecord(item) &&
      typeof item.path === "string" &&
      typeof item.contentHash === "string"
    );
}

function isSearchMode(value: unknown): value is SearchWorkspaceInput["mode"] {
  return value === "fullText" ||
    value === "fileName" ||
    value === "tag" ||
    value === "frontmatter";
}
