import type {
  GenerateTableOfContentsInput,
  GenerateTitleListInput,
  MergeCardsInput,
  SplitCardByHeadingInput
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
    hasOptionalString(input, "filterCardFolder") &&
    hasOptionalString(input, "filterTag") &&
    hasString(input, "outputCardFolder") &&
    hasString(input, "outputName") &&
    (input.sortBy === "name" || input.sortBy === "mtime")
  );
}

export function isGenerateTableOfContentsInput(input: unknown): input is GenerateTableOfContentsInput {
  return (
    isRecord(input) &&
    typeof input.includeSubcardFolders === "boolean" &&
    hasString(input, "outputCardFolder") &&
    hasString(input, "outputName") &&
    hasString(input, "targetCardFolder")
  );
}

export function isMergeCardsInput(input: unknown): input is MergeCardsInput {
  return (
    isRecord(input) &&
    hasOptionalString(input, "frontmatterField") &&
    (input.filterType === "cardFolder" ||
      input.filterType === "frontmatter" ||
      input.filterType === "tag" ||
      input.filterType === "all") &&
    hasString(input, "filterValue") &&
    typeof input.insertCardNameHeading === "boolean" &&
    hasString(input, "outputCardFolder") &&
    hasString(input, "outputName") &&
    (input.sortBy === "name" || input.sortBy === "mtime" || input.sortBy === "ctime")
  );
}

export function isSplitCardByHeadingInput(input: unknown): input is SplitCardByHeadingInput {
  return (
    isRecord(input) &&
    (input.headingLevel === 1 || input.headingLevel === 2 || input.headingLevel === 3) &&
    hasString(input, "outputCardFolder") &&
    hasString(input, "sourcePath")
  );
}
