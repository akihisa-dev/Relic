import type {
  GenerateTagIndexInput,
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
  outputFolder: string;
  outputName: string;
}

export interface TagIndexDraft {
  includeUntagged: boolean;
  outputFolder: string;
  outputName: string;
  sortBy: "name" | "mtime";
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
    outputFolder: "",
    outputName: t("tools.tocDefaultName")
  };
}

export function createDefaultTagIndexDraft(t: Translator): TagIndexDraft {
  return {
    includeUntagged: false,
    outputFolder: "",
    outputName: t("tools.tagIndexDefaultName"),
    sortBy: "name"
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

export function buildTitleListInput(draft: TitleListDraft, t: Translator, target: GenerateTitleListInput["target"]): GenerateTitleListInput {
  return {
    filterFolder: draft.filterFolder || undefined,
    outputFolder: draft.outputFolder || "",
    outputName: draft.outputName || t("tools.titleListDefaultName"),
    sortBy: draft.sortBy,
    target
  };
}

export function buildTocInput(draft: TocDraft, t: Translator, target: GenerateTableOfContentsInput["target"]): GenerateTableOfContentsInput {
  return {
    outputFolder: draft.outputFolder || "",
    outputName: draft.outputName || t("tools.tocDefaultName"),
    target
  };
}

export function buildTagIndexInput(draft: TagIndexDraft, t: Translator, target: GenerateTagIndexInput["target"]): GenerateTagIndexInput {
  return {
    includeUntagged: draft.includeUntagged,
    outputFolder: draft.outputFolder || "",
    outputName: draft.outputName || t("tools.tagIndexDefaultName"),
    sortBy: draft.sortBy,
    target
  };
}

export function buildMergeFilesInput(draft: MergeFilesDraft, t: Translator, target: MergeFilesInput["target"]): MergeFilesInput {
  return {
    frontmatterField: draft.filterType === "frontmatter" ? draft.frontmatterField : undefined,
    filterType: draft.filterType,
    filterValue: draft.filterValue,
    insertFilenameHeading: draft.insertFilenameHeading,
    outputFolder: draft.outputFolder || "",
    outputName: draft.outputName || t("tools.mergeDefaultName"),
    sortBy: draft.sortBy,
    target
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
