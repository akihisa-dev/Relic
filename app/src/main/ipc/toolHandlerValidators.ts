import type {
  GenerateTableOfContentsInput,
  GenerateTitleListInput,
  MergeFilesInput,
  SplitFileByHeadingInput
} from "../../shared/ipc";

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function hasString(input: Record<string, unknown>, key: string): boolean {
  return typeof input[key] === "string";
}

function hasOptionalString(input: Record<string, unknown>, key: string): boolean {
  return !(key in input) || typeof input[key] === "string";
}

export function isGenerateTitleListInput(input: unknown): input is GenerateTitleListInput {
  return (
    isRecord(input) &&
    hasOptionalString(input, "filterFolder") &&
    hasOptionalString(input, "filterTag") &&
    hasString(input, "outputFolder") &&
    hasString(input, "outputName") &&
    (input.sortBy === "name" || input.sortBy === "mtime")
  );
}

export function isGenerateTableOfContentsInput(input: unknown): input is GenerateTableOfContentsInput {
  return (
    isRecord(input) &&
    typeof input.includeSubfolders === "boolean" &&
    hasString(input, "outputFolder") &&
    hasString(input, "outputName") &&
    hasString(input, "targetFolder")
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
    typeof input.insertFilenameHeading === "boolean" &&
    hasString(input, "outputFolder") &&
    hasString(input, "outputName") &&
    (input.sortBy === "name" || input.sortBy === "mtime" || input.sortBy === "ctime")
  );
}

export function isSplitFileByHeadingInput(input: unknown): input is SplitFileByHeadingInput {
  return (
    isRecord(input) &&
    (input.headingLevel === 1 || input.headingLevel === 2 || input.headingLevel === 3) &&
    hasString(input, "outputFolder") &&
    hasString(input, "sourcePath")
  );
}
