import type {
  GenerateTableOfContentsInput,
  GenerateTitleListInput,
  MergeFilesInput,
  MergeFilterType,
  MergeSortBy
} from "../shared/ipc";
import type { RelicResult } from "../shared/result";
import type { Translator } from "./i18nModel";

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

export function createDefaultTitleListDraft(t: Translator): TitleListDraft {
  return {
    filterFolder: "",
    outputFolder: "",
    outputName: t("tools.titleListDefaultName"),
    sortBy: "name"
  };
}

export function createDefaultTocDraft(t: Translator): TocDraft {
  return {
    includeSubfolders: true,
    outputFolder: "",
    outputName: t("tools.tocDefaultName"),
    targetFolder: ""
  };
}

export function createDefaultMergeFilesDraft(t: Translator): MergeFilesDraft {
  return {
    filterType: "all",
    filterValue: "",
    frontmatterField: "",
    insertFilenameHeading: true,
    outputFolder: "",
    outputName: t("tools.mergeDefaultName"),
    sortBy: "name"
  };
}

export function buildTitleListInput(draft: TitleListDraft, t: Translator): GenerateTitleListInput {
  return {
    filterFolder: draft.filterFolder || undefined,
    outputFolder: draft.outputFolder || "",
    outputName: draft.outputName || t("tools.titleListDefaultName"),
    sortBy: draft.sortBy
  };
}

export function buildTocInput(draft: TocDraft, t: Translator): GenerateTableOfContentsInput {
  return {
    includeSubfolders: draft.includeSubfolders,
    outputFolder: draft.outputFolder || "",
    outputName: draft.outputName || t("tools.tocDefaultName"),
    targetFolder: draft.targetFolder || ""
  };
}

export function buildMergeFilesInput(draft: MergeFilesDraft, t: Translator): MergeFilesInput {
  return {
    frontmatterField: draft.filterType === "frontmatter" ? draft.frontmatterField : undefined,
    filterType: draft.filterType,
    filterValue: draft.filterValue,
    insertFilenameHeading: draft.insertFilenameHeading,
    outputFolder: draft.outputFolder || "",
    outputName: draft.outputName || t("tools.mergeDefaultName"),
    sortBy: draft.sortBy
  };
}

export function resultStatus<T>(result: RelicResult<T>, t: Translator, formatValue: (value: T) => string): string {
  return result.ok
    ? `${t("tools.statusDone")}: ${formatValue(result.value)}`
    : `${t("tools.statusError")}: ${result.error.message}`;
}

export function isToolStatusError(status: string | null): boolean {
  return status?.startsWith("Error") || status?.startsWith("エラー") || false;
}
