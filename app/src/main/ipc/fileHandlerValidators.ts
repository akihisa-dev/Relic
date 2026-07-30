import type {
  CreateFolderInput,
  CreateMarkdownFileInput,
  ImportImageFileInput,
  ImportMarkdownFilesInput,
  LinkUpdateImpactInput,
  MoveFolderInput,
  MoveItemToTrashInput,
  MoveMarkdownFileInput,
  ReadImageFileInput,
  ReadPdfFileInput,
  RenameFolderInput,
  RenameMarkdownFileInput,
  StartWorkspaceFileDragInput
} from "../../shared/ipc";
import { isSupportedMarkdownImagePath } from "../../shared/imageFiles";
import {
  maxImportMarkdownFiles
} from "../../shared/ipc/files";
import { isSupportedPdfPath } from "../../shared/pdfFiles";
import { isWorkspaceRelativeInputPathOrRoot } from "../files/paths";
import {
  isInputRecord,
  isLimitedWorkspaceRelativeInputPath,
  isLimitedWorkspaceRelativeInputPathOrRoot,
  isNameInput,
  isPathInput,
  isPathOrRootInput,
  isWorkspaceIdInput
} from "./inputValidation";

export function isCreateMarkdownFileInput(input: unknown): input is CreateMarkdownFileInput {
  return isNameInput(input);
}

export function isImportMarkdownFilesInput(input: unknown): input is ImportMarkdownFilesInput {
  if (!isInputRecord(input)) return false;

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
  if (!isInputRecord(input)) return false;

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
      input.parentFolder === undefined ||
      isWorkspaceRelativeInputPathOrRoot(input.parentFolder)
    )
  );
}

export function isLinkUpdateImpactInput(input: unknown): input is LinkUpdateImpactInput {
  if (!isInputRecord(input)) return false;

  return (
    (input.kind === "file" || input.kind === "folder") &&
    isLimitedWorkspaceRelativeInputPath(input.oldPath) &&
    isLimitedWorkspaceRelativeInputPath(input.newPath)
  );
}

export function isRevealWorkspaceItemInput(
  input: unknown
): input is { path: string; workspaceId?: string } {
  const workspaceId = (input as { workspaceId?: unknown })?.workspaceId;
  return (
    isPathOrRootInput(input) &&
    (workspaceId === undefined || isWorkspaceIdInput({ workspaceId }))
  );
}

export function isStartWorkspaceFileDragInput(
  input: unknown
): input is StartWorkspaceFileDragInput {
  if (!isInputRecord(input)) return false;

  return (
    Array.isArray(input.paths) &&
    input.paths.length > 0 &&
    input.paths.length <= maxImportMarkdownFiles &&
    input.paths.every(isLimitedWorkspaceRelativeInputPath)
  );
}

export function isRenameMarkdownFileInput(
  input: unknown
): input is RenameMarkdownFileInput {
  return (
    isInputRecord(input) &&
    "path" in input &&
    "newName" in input &&
    isLimitedWorkspaceRelativeInputPath(input.path) &&
    typeof input.newName === "string"
  );
}

export function isRenameFolderInput(input: unknown): input is RenameFolderInput {
  return (
    isInputRecord(input) &&
    "path" in input &&
    "newName" in input &&
    isLimitedWorkspaceRelativeInputPath(input.path) &&
    typeof input.newName === "string"
  );
}

export function isMoveItemToTrashInput(
  input: unknown
): input is MoveItemToTrashInput {
  return (
    isInputRecord(input) &&
    "path" in input &&
    "type" in input &&
    isLimitedWorkspaceRelativeInputPath(input.path) &&
    (input.type === "file" || input.type === "folder")
  );
}

export function isMoveMarkdownFileInput(
  input: unknown
): input is MoveMarkdownFileInput {
  return (
    isInputRecord(input) &&
    "path" in input &&
    "destinationFolder" in input &&
    isLimitedWorkspaceRelativeInputPath(input.path) &&
    isLimitedWorkspaceRelativeInputPathOrRoot(input.destinationFolder)
  );
}

export function isMoveFolderInput(input: unknown): input is MoveFolderInput {
  return (
    isInputRecord(input) &&
    "path" in input &&
    "destinationFolder" in input &&
    isLimitedWorkspaceRelativeInputPath(input.path) &&
    isLimitedWorkspaceRelativeInputPathOrRoot(input.destinationFolder)
  );
}
