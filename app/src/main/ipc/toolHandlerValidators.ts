import type {
  GenerateTableOfContentsInput,
  GenerateTitleListInput,
  MergeFilesInput
} from "../../shared/ipc";
import { isWorkspaceRelativeInputPath, isWorkspaceRelativeInputPathOrRoot } from "../files/paths";

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function hasString(input: Record<string, unknown>, key: string): boolean {
  return typeof input[key] === "string";
}

function hasWorkspaceFolder(input: Record<string, unknown>, key: string): boolean {
  return isWorkspaceRelativeInputPathOrRoot(input[key]);
}

function hasOptionalWorkspacePath(input: Record<string, unknown>, key: string): boolean {
  return !(key in input) || input[key] === undefined || isWorkspaceRelativeInputPath(input[key]);
}

function hasOptionalString(input: Record<string, unknown>, key: string): boolean {
  return !(key in input) || input[key] === undefined || typeof input[key] === "string";
}

export function isGenerateTitleListInput(input: unknown): input is GenerateTitleListInput {
  return (
    isRecord(input) &&
    hasOptionalWorkspacePath(input, "filterFolder") &&
    hasOptionalString(input, "filterTag") &&
    hasWorkspaceFolder(input, "outputFolder") &&
    hasString(input, "outputName") &&
    (input.sortBy === "name" || input.sortBy === "mtime")
  );
}

export function isGenerateTableOfContentsInput(input: unknown): input is GenerateTableOfContentsInput {
  return (
    isRecord(input) &&
    typeof input.includeSubfolders === "boolean" &&
    hasWorkspaceFolder(input, "outputFolder") &&
    hasString(input, "outputName") &&
    hasWorkspaceFolder(input, "targetFolder")
  );
}

export function isMergeFilesInput(input: unknown): input is MergeFilesInput {
  return (
    isRecord(input) &&
    hasOptionalString(input, "frontmatterField") &&
    (input.filterType === "folder" ||
      input.filterType === "frontmatter" ||
      input.filterType === "tag" ||
      input.filterType === "all") &&
    hasString(input, "filterValue") &&
    (input.filterType !== "folder" || isWorkspaceRelativeInputPathOrRoot(input.filterValue)) &&
    typeof input.insertFilenameHeading === "boolean" &&
    hasWorkspaceFolder(input, "outputFolder") &&
    hasString(input, "outputName") &&
    (input.sortBy === "name" || input.sortBy === "mtime" || input.sortBy === "ctime")
  );
}
