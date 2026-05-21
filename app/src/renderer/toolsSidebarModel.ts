import type {
  GenerateTableOfContentsInput,
  GenerateTitleListInput,
  MergeCardsInput,
  MergeFilterType,
  MergeSortBy,
  SplitCardByHeadingInput,
  SplitHeadingLevel
} from "../shared/ipc";
import type { RelicResult } from "../shared/result";
import type { Translator } from "./i18n";

export interface TitleListDraft {
  filterCardFolder: string;
  outputCardFolder: string;
  outputName: string;
  sortBy: "name" | "mtime";
}

export interface TocDraft {
  includeSubcardFolders: boolean;
  outputCardFolder: string;
  outputName: string;
  targetCardFolder: string;
}

export interface MergeCardsDraft {
  filterType: MergeFilterType;
  filterValue: string;
  frontmatterField: string;
  insertCardNameHeading: boolean;
  outputCardFolder: string;
  outputName: string;
  sortBy: MergeSortBy;
}

export interface SplitCardDraft {
  headingLevel: SplitHeadingLevel;
  outputCardFolder: string;
  sourcePath: string;
}

export function createDefaultTitleListDraft(t: Translator): TitleListDraft {
  return {
    filterCardFolder: "",
    outputCardFolder: "",
    outputName: t("tools.titleListDefaultName"),
    sortBy: "name"
  };
}

export function createDefaultTocDraft(t: Translator): TocDraft {
  return {
    includeSubcardFolders: true,
    outputCardFolder: "",
    outputName: t("tools.tocDefaultName"),
    targetCardFolder: ""
  };
}

export function createDefaultMergeCardsDraft(t: Translator): MergeCardsDraft {
  return {
    filterType: "all",
    filterValue: "",
    frontmatterField: "",
    insertCardNameHeading: true,
    outputCardFolder: "",
    outputName: t("tools.mergeDefaultName"),
    sortBy: "name"
  };
}

export function createDefaultSplitCardDraft(): SplitCardDraft {
  return {
    headingLevel: 2,
    outputCardFolder: "",
    sourcePath: ""
  };
}

export function buildTitleListInput(draft: TitleListDraft, t: Translator): GenerateTitleListInput {
  return {
    filterCardFolder: draft.filterCardFolder || undefined,
    outputCardFolder: draft.outputCardFolder || ".",
    outputName: draft.outputName || t("tools.titleListDefaultName"),
    sortBy: draft.sortBy
  };
}

export function buildTocInput(draft: TocDraft, t: Translator): GenerateTableOfContentsInput {
  return {
    includeSubcardFolders: draft.includeSubcardFolders,
    outputCardFolder: draft.outputCardFolder || ".",
    outputName: draft.outputName || t("tools.tocDefaultName"),
    targetCardFolder: draft.targetCardFolder || "."
  };
}

export function buildMergeCardsInput(draft: MergeCardsDraft, t: Translator): MergeCardsInput {
  return {
    frontmatterField: draft.filterType === "frontmatter" ? draft.frontmatterField : undefined,
    filterType: draft.filterType,
    filterValue: draft.filterValue,
    insertCardNameHeading: draft.insertCardNameHeading,
    outputCardFolder: draft.outputCardFolder || ".",
    outputName: draft.outputName || t("tools.mergeDefaultName"),
    sortBy: draft.sortBy
  };
}

export function buildSplitCardInput(draft: SplitCardDraft): SplitCardByHeadingInput {
  return {
    headingLevel: draft.headingLevel,
    outputCardFolder: draft.outputCardFolder || ".",
    sourcePath: draft.sourcePath
  };
}

export function resultStatus<T>(result: RelicResult<T>, t: Translator, formatValue: (value: T) => string): string {
  return result.ok
    ? `${t("tools.statusDone")}: ${formatValue(result.value)}`
    : `${t("tools.statusError")}: ${result.error.message}`;
}

export function splitResultStatus(result: RelicResult<string[]>, t: Translator): string {
  return resultStatus(result, t, (value) => t("tools.splitResultCreated", { count: value.length }));
}

export function isToolStatusError(status: string | null): boolean {
  return status?.startsWith("Error") || status?.startsWith("エラー") || false;
}
