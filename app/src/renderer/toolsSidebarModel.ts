import type {
  GenerateTableOfContentsInput,
  GenerateTitleListInput,
  MergeFilesInput,
  MergeFilterType,
  MergeSortBy,
  SplitFileByHeadingInput,
  SplitHeadingLevel
} from "../shared/ipc";
import type { RelicResult } from "../shared/result";
import type { Translator } from "./i18n";

export interface TitleListDraft {
  filterFolder: string;
  outputFolder: string;
  outputName: string;
  sortBy: "name" | "mtime";
}

export interface TocDraft {
  includeSubfolders: boolean;
  outputFolder: string;
  outputName: string;
  targetFolder: string;
}

export interface MergeFilesDraft {
  filterType: MergeFilterType;
  filterValue: string;
  frontmatterField: string;
  insertFilenameHeading: boolean;
  outputFolder: string;
  outputName: string;
  sortBy: MergeSortBy;
}

export interface SplitFileDraft {
  headingLevel: SplitHeadingLevel;
  outputFolder: string;
  sourcePath: string;
}

export function createDefaultTitleListDraft(): TitleListDraft {
  return {
    filterFolder: "",
    outputFolder: "",
    outputName: "Title List",
    sortBy: "name"
  };
}

export function createDefaultTocDraft(): TocDraft {
  return {
    includeSubfolders: true,
    outputFolder: "",
    outputName: "Table of Contents",
    targetFolder: ""
  };
}

export function createDefaultMergeFilesDraft(): MergeFilesDraft {
  return {
    filterType: "all",
    filterValue: "",
    frontmatterField: "",
    insertFilenameHeading: true,
    outputFolder: "",
    outputName: "Merged Result",
    sortBy: "name"
  };
}

export function createDefaultSplitFileDraft(): SplitFileDraft {
  return {
    headingLevel: 2,
    outputFolder: "",
    sourcePath: ""
  };
}

export function buildTitleListInput(draft: TitleListDraft, t: Translator): GenerateTitleListInput {
  return {
    filterFolder: draft.filterFolder || undefined,
    outputFolder: draft.outputFolder || ".",
    outputName: draft.outputName || t("tools.titleListDefaultName"),
    sortBy: draft.sortBy
  };
}

export function buildTocInput(draft: TocDraft, t: Translator): GenerateTableOfContentsInput {
  return {
    includeSubfolders: draft.includeSubfolders,
    outputFolder: draft.outputFolder || ".",
    outputName: draft.outputName || t("tools.tocDefaultName"),
    targetFolder: draft.targetFolder || "."
  };
}

export function buildMergeFilesInput(draft: MergeFilesDraft, t: Translator): MergeFilesInput {
  return {
    frontmatterField: draft.filterType === "frontmatter" ? draft.frontmatterField : undefined,
    filterType: draft.filterType,
    filterValue: draft.filterValue,
    insertFilenameHeading: draft.insertFilenameHeading,
    outputFolder: draft.outputFolder || ".",
    outputName: draft.outputName || t("tools.mergeDefaultName"),
    sortBy: draft.sortBy
  };
}

export function buildSplitFileInput(draft: SplitFileDraft): SplitFileByHeadingInput {
  return {
    headingLevel: draft.headingLevel,
    outputFolder: draft.outputFolder || ".",
    sourcePath: draft.sourcePath
  };
}

export function resultStatus<T>(result: RelicResult<T>, formatValue: (value: T) => string): string {
  return result.ok ? `Done: ${formatValue(result.value)}` : `Error: ${result.error.message}`;
}

export function splitResultStatus(result: RelicResult<string[]>): string {
  return resultStatus(result, (value) => `${value.length} file(s) created`);
}

export function isToolStatusError(status: string | null): boolean {
  return status?.startsWith("Error") ?? false;
}
