import {
  maxToolTargetFiles,
  type GenerateTagIndexInput,
  type GenerateTableOfContentsInput,
  type GenerateTitleListInput,
  type MergeFilesInput
} from "../../shared/ipc";
import { maxWorkspaceRelativePathLength } from "../../shared/ipc/files";
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

function hasOptionalToolTarget(input: Record<string, unknown>): boolean {
  if (!("target" in input) || input.target === undefined) return true;
  if (!isRecord(input.target)) return false;
  if (input.target.kind === "workspace") return Object.keys(input.target).length === 1;
  if (input.target.kind === "folder") {
    return typeof input.target.path === "string"
      && input.target.path.length <= maxWorkspaceRelativePathLength
      && isWorkspaceRelativeInputPath(input.target.path);
  }
  if (input.target.kind !== "files" || !Array.isArray(input.target.paths)) return false;
  if (input.target.paths.length < 2 || input.target.paths.length > maxToolTargetFiles) return false;
  const paths = input.target.paths;
  return paths.every((value) => (
    typeof value === "string"
    && value.length <= maxWorkspaceRelativePathLength
    && isWorkspaceRelativeInputPath(value)
    && /\.md$/i.test(value)
  )) && new Set(paths).size === paths.length;
}

export function isGenerateTitleListInput(input: unknown): input is GenerateTitleListInput {
  return (
    isRecord(input) &&
    hasOptionalWorkspacePath(input, "filterFolder") &&
    hasOptionalString(input, "filterTag") &&
    hasWorkspaceFolder(input, "outputFolder") &&
    hasString(input, "outputName") &&
    (input.sortBy === "name" || input.sortBy === "mtime") &&
    hasOptionalToolTarget(input)
  );
}

export function isGenerateTableOfContentsInput(input: unknown): input is GenerateTableOfContentsInput {
  return (
    isRecord(input) &&
    typeof input.includeSubfolders === "boolean" &&
    hasWorkspaceFolder(input, "outputFolder") &&
    hasString(input, "outputName") &&
    hasWorkspaceFolder(input, "targetFolder") &&
    hasOptionalToolTarget(input)
  );
}

export function isGenerateTagIndexInput(input: unknown): input is GenerateTagIndexInput {
  return (
    isRecord(input) &&
    typeof input.includeSubfolders === "boolean" &&
    typeof input.includeUntagged === "boolean" &&
    hasWorkspaceFolder(input, "outputFolder") &&
    hasString(input, "outputName") &&
    (input.sortBy === "name" || input.sortBy === "mtime") &&
    hasWorkspaceFolder(input, "targetFolder") &&
    hasOptionalToolTarget(input)
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
    (input.sortBy === "name" || input.sortBy === "mtime" || input.sortBy === "ctime") &&
    hasOptionalToolTarget(input)
  );
}
