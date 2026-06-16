import { reservedFrontmatterFieldNames } from "../shared/frontmatterFields";
import type { SearchMode, UserDefinedField } from "../shared/ipc";
import type { Translator } from "./i18nModel";

export interface FileSearchModeOption {
  label: string;
  mode: SearchMode;
}

export function knownFrontmatterSearchFields(userDefinedFields: UserDefinedField[]): string[] {
  return Array.from(
    new Set([
      ...reservedFrontmatterFieldNames,
      ...userDefinedFields.map((field) => field.name)
    ])
  ).sort((a, b) => a.localeCompare(b, "ja"));
}

export function frontmatterValueCandidatesForField(
  candidates: Record<string, string[]>,
  field: string
): string[] {
  return field ? (candidates[field] ?? []) : [];
}

export function isFilteringFiles({
  isSearching,
  query,
  searchError
}: {
  isSearching: boolean;
  query: string;
  searchError: string | null;
}): boolean {
  return query.trim() !== "" || isSearching || searchError !== null;
}

export function fileSearchModeOptions(t: Translator): FileSearchModeOption[] {
  return [
    { label: t("files.searchModeFullText"), mode: "fullText" },
    { label: t("files.searchModeFileName"), mode: "fileName" },
    { label: t("files.searchModeTag"), mode: "tag" },
    { label: t("files.searchModeFrontmatter"), mode: "frontmatter" },
    { label: t("files.searchModeRegex"), mode: "regex" }
  ];
}

export function activeFileSearchModeLabel(
  options: FileSearchModeOption[],
  mode: SearchMode,
  fallback: string
): string {
  return options.find((option) => option.mode === mode)?.label ?? fallback;
}
